import { useState, useEffect, useCallback, useRef } from 'react'
import supabase from '@/lib/supabase'
import { p2pStun, p2pConnect } from '@/services/tauri/p2p'
import { getIsPhone } from '@/hooks/runtime'

export type P2PConnState = 'idle' | 'connecting' | 'connected' | 'offline' | 'error'

// ── Endpoint cache (localStorage) ────────────────────────────────────────────

const CACHE_KEY = 'p2p_desktop_cache'

interface DesktopCache {
  public_ip: string
  public_port: number
  local_ip: string | null
  local_port: number | null
}

function loadCache(): DesktopCache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? (JSON.parse(raw) as DesktopCache) : null
  } catch { return null }
}

function saveCache(d: DesktopCache) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(d)) } catch {}
}

function clearCache() {
  try { localStorage.removeItem(CACHE_KEY) } catch {}
}

function resolveEndpoint(
  data: { public_ip: string; public_port: number; local_ip: string | null; local_port: number | null },
  phonePublicIp: string,
): string {
  const sameLan = !!data.local_ip && !!data.local_port && phonePublicIp === data.public_ip
  return sameLan
    ? `${data.local_ip}:${data.local_port}`
    : `${data.public_ip}:${data.public_port}`
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useP2PConnection() {
  const [state, setState] = useState<P2PConnState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const connecting = useRef(false)
  const stateRef = useRef<P2PConnState>('idle')

  const log = (msg: string) => {
    console.log('[p2p]', msg)
    if (import.meta.env.DEV) setLogs(prev => [...prev.slice(-49), `${new Date().toISOString().slice(11, 23)} ${msg}`])
  }

  const dismiss = useCallback(() => {
    stateRef.current = 'idle'
    setState('idle')
    setError(null)
  }, [])

  const connect = useCallback(async () => {
    if (connecting.current) { log('already connecting, skipping'); return }
    if (stateRef.current === 'connected') { log('already connected, skipping'); return }
    connecting.current = true
    try {
    const isPhone = await getIsPhone()
    if (!isPhone || !supabase) { return }

    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) { log('no session'); return }

    stateRef.current = 'connecting'
    setState('connecting')
    setError(null)
    if (import.meta.env.DEV) setLogs([])

    try {
      // Kick off DB fetch immediately in the background — it runs in parallel
      // with the cached fast-path attempt so we waste no time on cache miss.
      const dbFetch = supabase
        .from('peer_endpoints')
        .select('public_ip, public_port, local_ip, local_port')
        .eq('user_id', session.user.id)
        .single()

      // ── Fast path: try cached endpoint (5 s timeout) ──────────────────
      const cached = loadCache()
      if (cached) {
        log('trying cached desktop endpoint…')
        try {
          const phoneEndpoint = await p2pStun()
          const [phoneIp, phonePortStr] = phoneEndpoint.split(':')
          const desktopEndpoint = resolveEndpoint(cached, phoneIp)
          log(`cache: trying ${desktopEndpoint} (5 s)`)

          const { error: updateErr } = await supabase
            .from('peer_endpoints')
            .update({ phone_ip: phoneIp, phone_port: parseInt(phonePortStr, 10) })
            .eq('user_id', session.user.id)
          if (updateErr) throw new Error(`register phone: ${updateErr.message}`)

          await p2pConnect(session.access_token, desktopEndpoint, 5)
          log('connected via cache!')
          stateRef.current = 'connected'
          setState('connected')
          return
        } catch (cacheErr) {
          log(`cache miss: ${cacheErr instanceof Error ? cacheErr.message : String(cacheErr)}`)
          clearCache()
          // Fall through — DB fetch is already in flight
        }
      }

      // ── Slow path: use DB result ──────────────────────────────────────
      log('fetching desktop endpoint from DB…')
      const { data, error: dbErr } = await dbFetch

      if (dbErr || !data) {
        log(`DB error: ${dbErr?.message ?? 'no row'}`)
        stateRef.current = 'offline'
        setState('offline')
        setError('Desktop is offline — open Codexia on your desktop and enable P2P')
        return
      }
      log(`desktop: public=${data.public_ip}:${data.public_port} local=${data.local_ip}:${data.local_port}`)

      const phoneEndpoint = await p2pStun()
      const [phoneIp, phonePortStr] = phoneEndpoint.split(':')
      log(`phone STUN endpoint: ${phoneEndpoint}`)

      const desktopEndpoint = resolveEndpoint(data, phoneIp)
      log(`connecting to ${desktopEndpoint}`)

      const { error: updateErr } = await supabase
        .from('peer_endpoints')
        .update({ phone_ip: phoneIp, phone_port: parseInt(phonePortStr, 10) })
        .eq('user_id', session.user.id)
      if (updateErr) throw new Error(`Failed to register phone endpoint: ${updateErr.message}`)
      log('phone endpoint registered, waiting for punch…')

      await p2pConnect(session.access_token, desktopEndpoint)
      log('connected!')

      // Cache for next startup
      saveCache({
        public_ip: data.public_ip,
        public_port: data.public_port,
        local_ip: data.local_ip,
        local_port: data.local_port,
      })

      stateRef.current = 'connected'
      setState('connected')
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      log(`error: ${msg}`)
      stateRef.current = 'error'
      setState('error')
      setError(msg)
    }
    } finally {
      connecting.current = false
    }
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!supabase) return

    void connect()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') void connect()
      if (event === 'SIGNED_OUT') { stateRef.current = 'idle'; setState('idle'); setError(null) }
    })

    const pollInterval = setInterval(() => {
      if (stateRef.current === 'idle') void connect()
    }, 5000)

    return () => {
      subscription.unsubscribe()
      clearInterval(pollInterval)
      connecting.current = false
    }
  }, [connect])

  return { state, error, logs, retry: connect, dismiss }
}
