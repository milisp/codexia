use tauri::{
    AppHandle, Manager, PhysicalPosition, WebviewUrl, WebviewWindowBuilder,
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
};

const PANEL_WIDTH: f64 = 370.0;
const PANEL_HEIGHT: f64 = 370.0;

pub fn setup(app: &AppHandle) -> tauri::Result<()> {
    let mut tray = TrayIconBuilder::with_id("usage")
        .tooltip("Codexia usage")
        .show_menu_on_left_click(false)
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                position,
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("usage") {
                    if window.is_visible().unwrap_or(false) {
                        let _ = window.hide();
                    } else {
                        show_panel(&window, position);
                    }
                }
            }
        });
    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    tray.build(app)?;

    let panel = WebviewWindowBuilder::new(app, "usage", WebviewUrl::App("/usage".into()))
        .title("Usage")
        .inner_size(PANEL_WIDTH, PANEL_HEIGHT)
        .resizable(false)
        .decorations(false)
        .transparent(true)
        .always_on_top(true)
        .skip_taskbar(true)
        .visible(false)
        .build()?;
    let panel_for_events = panel.clone();
    panel.on_window_event(move |event| match event {
        tauri::WindowEvent::Focused(false) => {
            let _ = panel_for_events.hide();
        }
        tauri::WindowEvent::CloseRequested { api, .. } => {
            api.prevent_close();
            let _ = panel_for_events.hide();
        }
        _ => {}
    });
    Ok(())
}

fn show_panel(window: &tauri::WebviewWindow, click: PhysicalPosition<f64>) {
    let scale = window.scale_factor().unwrap_or(1.0);
    let width = PANEL_WIDTH * scale;
    let height = PANEL_HEIGHT * scale;
    let monitor = window.current_monitor().ok().flatten();
    let mut x = click.x - width / 2.0;
    let mut y = click.y + 12.0 * scale;
    if let Some(monitor) = monitor {
        let origin = monitor.position();
        let size = monitor.size();
        x = x.clamp(origin.x as f64, (origin.x + size.width as i32) as f64 - width);
        y = y.clamp(origin.y as f64, (origin.y + size.height as i32) as f64 - height);
    }
    let _ = window.set_position(PhysicalPosition::new(x, y));
    let _ = window.show();
    let _ = window.set_focus();
}
