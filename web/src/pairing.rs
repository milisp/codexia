//! `codexia-web pair`: how another device connects to this server.
//!
//! Prints a browser link and the `codexia://pair` URI the mobile app scans,
//! with a terminal QR code, so a headless server can be paired without a
//! desktop UI. The token is read on demand rather than logged at startup, so
//! it does not end up in a service journal.

use crate::auth::DeviceToken;

/// Where a device should connect, and with which credential.
pub struct PairingLinks {
    /// Opens the web UI and hands it the token through the URL fragment,
    /// which browsers never send to the server or proxies.
    pub browser: String,
    /// The payload of the mobile app's QR code (see `src/lib/pairing.ts`).
    pub app: String,
}

/// Percent-encodes a query or fragment value.
fn encode(value: &str) -> String {
    let mut out = String::with_capacity(value.len());
    for byte in value.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'.' | b'_' | b'~' => {
                out.push(byte as char)
            }
            _ => out.push_str(&format!("%{byte:02X}")),
        }
    }
    out
}

/// Builds both links for `host:port`. `name` is shown in the app's list of
/// machines.
pub fn links(host: &str, port: u16, token: &str, name: &str) -> PairingLinks {
    let token = encode(token);
    let mut app = format!("codexia://pair?host={}&port={port}&token={token}", encode(host));
    if !name.is_empty() {
        app.push_str(&format!("&name={}", encode(name)));
    }
    PairingLinks {
        browser: format!("http://{host}:{port}/#token={token}"),
        app,
    }
}

/// The address other devices should use: the tailnet name when Tailscale is
/// up, since the iOS app only connects to `*.ts.net` over plain HTTP.
fn default_host() -> Option<String> {
    crate::tailscale::detect().map(|info| info.dns_name)
}

/// Runs `codexia-web pair [--host NAME] [--port N] [--rotate]`.
pub fn run(args: &[String], default_port: u16) -> Result<(), String> {
    let mut host = None;
    let mut port = default_port;
    let mut rotate = false;
    let mut iter = args.iter();
    while let Some(arg) = iter.next() {
        match arg.as_str() {
            "--host" => host = iter.next().cloned(),
            "--rotate" => rotate = true,
            "--port" => {
                port = iter
                    .next()
                    .and_then(|v| v.parse().ok())
                    .ok_or("--port needs a number")?;
            }
            other => return Err(format!("unknown argument: {other}")),
        }
    }
    let host = host.or_else(default_host).ok_or(
        "Tailscale is not running here. Pass the address other devices use, \
         for example: codexia-web pair --host my-server.tail1234.ts.net",
    )?;
    let token = if rotate { DeviceToken::rotate()? } else { DeviceToken::load_or_create()? };
    let name = host.split('.').next().unwrap_or(&host).to_string();
    let links = links(&host, port, token.value(), &name);

    println!("Browser:\n  {}\n", links.browser);
    println!("Codexia app (scan, or paste the link):\n  {}\n", links.app);
    match qrcode::QrCode::new(links.app.as_bytes()) {
        Ok(code) => println!(
            "{}",
            code.render::<qrcode::render::unicode::Dense1x2>()
                .quiet_zone(true)
                .build()
        ),
        Err(e) => eprintln!("could not render a QR code: {e}"),
    }
    if rotate {
        println!("New token issued. Restart codexia-web for it to take effect; paired devices must pair again.");
    }
    println!("Anyone with this token controls this server. If it leaks, run: codexia-web pair --rotate");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_browser_and_app_links() {
        let links = links("box.tail1.ts.net", 7420, "abc123", "box");
        assert_eq!(links.browser, "http://box.tail1.ts.net:7420/#token=abc123");
        assert_eq!(
            links.app,
            "codexia://pair?host=box.tail1.ts.net&port=7420&token=abc123&name=box"
        );
    }

    #[test]
    fn encodes_reserved_characters() {
        let links = links("h", 1, "a&b", "my box");
        assert!(links.app.ends_with("token=a%26b&name=my%20box"));
    }
}
