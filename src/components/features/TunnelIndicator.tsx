import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'
import { useTunnel } from '@/hooks/useTunnel'
import { isTauri, isPhone } from '@/hooks/runtime'
import { useSettingsStore } from '@/stores/settings/useSettingsStore'
import supabase from '@/lib/supabase'

export function TunnelIndicator() {
  const { status, loading, start, stop } = useTunnel()
  const setP2pAutoStart = useSettingsStore((s) => s.setP2pAutoStart)
  const [starting, setStarting] = useState(false)

  // Desktop only — mobile connects via useP2PConnection in App.tsx
  if (!isTauri() || isPhone) return null

  const handleStart = async () => {
    if (supabase) {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        toast.info('Please log in to enable remote tunnel')
        return
      }
    }
    setP2pAutoStart(true)
    setStarting(true)
    await start()
    setStarting(false)
  }

  const handleStop = () => { setP2pAutoStart(false); stop() }

  return (
    <div className="flex items-center gap-1.5 px-1">
      <span className="text-xs text-muted-foreground">Remote</span>
      {starting && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
      <Switch
        checked={status.connected}
        onCheckedChange={(v) => v ? handleStart() : handleStop()}
        disabled={loading}
        className="scale-75 origin-right"
      />
    </div>
  )
}
