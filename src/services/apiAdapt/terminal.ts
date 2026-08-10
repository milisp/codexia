import { dual, dualVoid, type TerminalStartResponse } from './shared';

export async function terminalStart(cwd?: string | null, cols?: number, rows?: number) {
  return await dual<TerminalStartResponse>(
    'terminal_start',
    { cwd, cols, rows },
    '/api/terminal/start',
    {
      cwd,
      cols,
      rows,
    }
  );
}

export async function terminalWrite(sessionId: string, data: string) {
  await dualVoid(
    'terminal_write',
    { params: { session_id: sessionId, data } },
    '/api/terminal/write',
    { session_id: sessionId, data }
  );
}

export async function terminalResize(sessionId: string, cols: number, rows: number) {
  await dualVoid(
    'terminal_resize',
    { params: { session_id: sessionId, cols, rows } },
    '/api/terminal/resize',
    { session_id: sessionId, cols, rows }
  );
}

export async function terminalStop(sessionId: string) {
  await dualVoid('terminal_stop', { params: { session_id: sessionId } }, '/api/terminal/stop', {
    session_id: sessionId,
  });
}
