# Remote control Web Server Guide

This guide covers local web-mode and packaging for Codexia web server without GUI.

## Run after installation

### Headless binary (Linux / Windows / macOS)

The prebuilt headless binary is compiled without GUI (no Tauri). Just run it directly:

```sh
./codexia
```

Optional flags:

```sh
./codexia --port 7420 --host   # custom port + bind to 0.0.0.0 for external access
```

> `--web` flag is **not** needed for the headless binary and has no effect.

## Develop frontend and Rust backend together

Run:

```sh
just dev-web
```

## Build headless web package without GUI from source

Linux/macOS:

```sh
bash scripts/package-web.sh
```

Windows:

```bat
scripts/package-web.bat
```
