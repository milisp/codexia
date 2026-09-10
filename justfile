set shell := ["bash", "-eu", "-o", "pipefail", "-c"]
set dotenv-load := true

backend_port := env_var_or_default("VITE_WEB_PORT", "7420")

dev-web:
  @echo "Starting backend router server on :{{backend_port}} and frontend on :1420"
  @echo "API base and WS route (/ws) both use backend port :{{backend_port}}"
  @echo "Opening Vite frontend; API and WebSocket requests are proxied to :{{backend_port}}"
  @trap 'kill 0' EXIT INT TERM; \
    (CODEXIA_NO_BROWSER=1 VITE_WEB_PORT={{backend_port}} cargo watch -w crates -w Cargo.toml -x 'run --bin codexia-web -- --port {{backend_port}}') & \
    echo "Waiting for backend http://localhost:{{backend_port}}/health..."; \
    until curl -sf http://localhost:{{backend_port}}/health >/dev/null; do sleep 0.2; done; \
    echo "Backend is ready"; \
    (VITE_WEB_PORT={{backend_port}} bun run dev) & \
    until curl -sf http://localhost:1420/ >/dev/null; do sleep 0.2; done; \
    open http://localhost:1420/; \
    wait
