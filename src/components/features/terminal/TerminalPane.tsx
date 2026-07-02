import { listen } from '@tauri-apps/api/event';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { buildWsUrl, isTauri } from '@/hooks/runtime';
import { terminalResize, terminalStart, terminalStop, terminalWrite } from '@/services/tauri';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';

const IS_TAURI = isTauri();

const TERMINAL_THEME = {
  fontFamily: 'Menlo, Monaco, Consolas, monospace',
  fontSize: 12,
  background: '#0a0a0a',
} as const;

type TerminalDataPayload = { session_id: string; data: string };
type TerminalExitPayload = { session_id: string; message: string };

interface TerminalPaneProps {
  id: string;
  active: boolean;
  panelOpen: boolean;
}

export function TerminalPane({ id, active, panelOpen }: TerminalPaneProps) {
  const { cwd } = useWorkspaceStore();
  console.log(id, active, panelOpen);

  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const isStartingRef = useRef(false);
  const isAttachedRef = useRef(false);

  const [, setSessionId] = useState<string | null>(null);

  const setSession = useCallback((sid: string | null) => {
    sessionIdRef.current = sid;
    setSessionId(sid);
  }, []);

  // Create Terminal instance once per pane
  useEffect(() => {
    const term = new Terminal({
      convertEol: false,
      cursorBlink: true,
      fontFamily: TERMINAL_THEME.fontFamily,
      fontSize: TERMINAL_THEME.fontSize,
      scrollback: 5000,
      theme: { background: TERMINAL_THEME.background },
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    const disposeData = term.onData((data) => {
      const sid = sessionIdRef.current;
      if (!sid) return;
      void terminalWrite(sid, data).catch((err) => {
        term.writeln(`\r\n[write failed] ${String(err)}`);
      });
    });

    terminalRef.current = term;
    fitAddonRef.current = fitAddon;

    return () => {
      disposeData.dispose();
      term.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
      isAttachedRef.current = false;
    };
  }, []);

  // Attach xterm to DOM on first activation; re-fit on subsequent activations
  useEffect(() => {
    if (!active || !panelOpen) return;
    const term = terminalRef.current;
    const fitAddon = fitAddonRef.current;
    const container = containerRef.current;
    if (!term || !fitAddon || !container) return;

    if (!isAttachedRef.current) {
      term.open(container);
      isAttachedRef.current = true;
    }

    requestAnimationFrame(() => {
      fitAddon.fit();
      term.focus();
    });
  }, [active, panelOpen]);

  // Start backend session once attached
  const startSession = useCallback(async () => {
    const term = terminalRef.current;
    const fitAddon = fitAddonRef.current;
    // Allow both desktop Tauri and web (HTTP API) mode —
    // service layer routes to invokeTauri or postJson accordingly.
    if (!term || !fitAddon || sessionIdRef.current || isStartingRef.current) return;

    isStartingRef.current = true;
    try {
      fitAddon.fit();
      const { session_id } = await terminalStart(
        cwd,
        Math.max(term.cols, 2),
        Math.max(term.rows, 2)
      );
      setSession(session_id);
    } catch (err) {
      terminalRef.current?.writeln(`\r\n[session start failed] ${String(err)}`);
    } finally {
      isStartingRef.current = false;
    }
  }, [cwd, setSession]);

  useEffect(() => {
    if (!active || !panelOpen) return;
    void startSession();
  }, [active, panelOpen, startSession]);

  // Tauri desktop event listeners — scoped to this pane's session
  useEffect(() => {
    if (!IS_TAURI) return;
    let cancelled = false;
    let unlistenData: (() => void) | null = null;
    let unlistenExit: (() => void) | null = null;

    const setup = async () => {
      const dataFn = await listen<TerminalDataPayload>('terminal:data', (event) => {
        if (event.payload.session_id !== sessionIdRef.current) return;
        terminalRef.current?.write(event.payload.data);
      });
      const exitFn = await listen<TerminalExitPayload>('terminal:exit', (event) => {
        if (event.payload.session_id !== sessionIdRef.current) return;
        terminalRef.current?.writeln(`\r\n[${event.payload.message}]`);
        setSession(null);
      });
      if (cancelled) {
        dataFn();
        exitFn();
        return;
      }
      unlistenData = dataFn;
      unlistenExit = exitFn;
    };
    void setup();

    return () => {
      cancelled = true;
      unlistenData?.();
      unlistenExit?.();
    };
  }, [setSession]);

  // Web mode: WebSocket listener for terminal:data and terminal:exit
  useEffect(() => {
    if (IS_TAURI) return;

    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let closedByCleanup = false;

    const connect = () => {
      ws = new WebSocket(buildWsUrl('/ws'));

      ws.onmessage = (messageEvent) => {
        try {
          const envelope = JSON.parse(messageEvent.data as string) as {
            event?: string;
            payload?: unknown;
          };

          if (envelope.event === 'terminal:data' && envelope.payload) {
            const payload = envelope.payload as TerminalDataPayload;
            if (payload.session_id !== sessionIdRef.current) return;
            terminalRef.current?.write(payload.data);
          } else if (envelope.event === 'terminal:exit' && envelope.payload) {
            const payload = envelope.payload as TerminalExitPayload;
            if (payload.session_id !== sessionIdRef.current) return;
            terminalRef.current?.writeln(`\r\n[${payload.message}]`);
            setSession(null);
          }
        } catch (error) {
          console.warn('[TerminalPane] Failed to parse websocket message:', error);
        }
      };

      ws.onclose = () => {
        if (closedByCleanup) return;
        reconnectTimer = setTimeout(connect, 2000);
      };

      ws.onerror = () => {
        ws?.close();
      };
    };

    connect();

    return () => {
      closedByCleanup = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [setSession]);

  // Resize — only when this pane is active and visible
  useEffect(() => {
    const fitAndResize = () => {
      if (!active || !panelOpen) return;
      const term = terminalRef.current;
      const fitAddon = fitAddonRef.current;
      if (!term || !fitAddon) return;
      fitAddon.fit();
      const sid = sessionIdRef.current;
      if (sid) {
        void terminalResize(sid, Math.max(term.cols, 2), Math.max(term.rows, 2));
      }
    };

    const observer = new ResizeObserver(fitAndResize);
    if (active && panelOpen && containerRef.current) {
      observer.observe(containerRef.current);
    }
    return () => observer.disconnect();
  }, [active, panelOpen]);

  // Stop session on pane unmount
  useEffect(() => {
    return () => {
      const sid = sessionIdRef.current;
      if (sid) void terminalStop(sid);
    };
  }, []);

  return (
    <div className="absolute inset-0" style={{ visibility: active ? 'visible' : 'hidden' }}>
      <div
        ref={containerRef}
        className="h-full w-full px-2 py-2"
        onMouseDown={() => terminalRef.current?.focus()}
      />
    </div>
  );
}
