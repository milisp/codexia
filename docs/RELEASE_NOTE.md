## 🐛 Fixes

- Codex permission escalation requests now reach the UI, so commands that need elevated access prompt you instead of stalling.
- MCP elicitation requests are forwarded to the UI, so servers asking for input can be answered.
- Provider environment variables are passed to the `app-server` child process, so custom providers get their API keys.
