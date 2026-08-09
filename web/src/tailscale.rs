use std::path::PathBuf;
use std::process::Command;

use serde::Serialize;
use serde_json::Value;

/// This machine's identity on the tailnet.
#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
pub struct TailscaleInfo {
    /// MagicDNS name, e.g. `codexia-mac.tail1234.ts.net`. Stable across restarts.
    pub dns_name: String,
    /// Tailnet IPv4, e.g. `100.x.y.z`.
    pub ipv4: String,
}

/// Locations the Tailscale CLI is typically found in.
///
/// The macOS app bundle ships its own binary that is usually not on `PATH`,
/// so looking only for `tailscale` would miss the most common desktop install.
fn cli_candidates() -> Vec<PathBuf> {
    vec![
        PathBuf::from("tailscale"),
        PathBuf::from("/usr/local/bin/tailscale"),
        PathBuf::from("/opt/homebrew/bin/tailscale"),
        PathBuf::from("/Applications/Tailscale.app/Contents/MacOS/Tailscale"),
    ]
}

fn run_status_json() -> Option<String> {
    for candidate in cli_candidates() {
        let output = Command::new(&candidate).args(["status", "--json"]).output();
        match output {
            Ok(output) if output.status.success() => {
                return String::from_utf8(output.stdout).ok();
            }
            Ok(output) => {
                log::debug!(
                    "[tailscale] {} exited with {}",
                    candidate.display(),
                    output.status
                );
            }
            Err(err) => {
                log::debug!("[tailscale] {} not usable: {err}", candidate.display());
            }
        }
    }
    None
}

/// Extracts this node's MagicDNS name and tailnet IPv4 from `tailscale status --json`.
fn parse_status(raw: &str) -> Option<TailscaleInfo> {
    let status: Value = serde_json::from_str(raw).ok()?;
    let self_node = status.get("Self")?;

    // MagicDNS names carry a trailing dot in the status output.
    let dns_name = self_node
        .get("DNSName")?
        .as_str()?
        .trim_end_matches('.')
        .to_string();
    if dns_name.is_empty() {
        return None;
    }

    let ipv4 = self_node
        .get("TailscaleIPs")?
        .as_array()?
        .iter()
        .filter_map(|v| v.as_str())
        .find(|ip| !ip.contains(':'))?
        .to_string();

    Some(TailscaleInfo { dns_name, ipv4 })
}

/// Returns this machine's tailnet identity, or `None` when Tailscale is not
/// installed, not running, or this node is logged out.
pub fn detect() -> Option<TailscaleInfo> {
    let raw = run_status_json()?;
    let info = parse_status(&raw);
    if info.is_none() {
        log::debug!("[tailscale] status returned no usable Self node");
    }
    info
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE: &str = r#"{
      "Self": {
        "DNSName": "codexia-mac.tail1234.ts.net.",
        "TailscaleIPs": ["100.101.102.103", "fd7a:115c:a1e0::1"]
      }
    }"#;

    #[test]
    fn parses_dns_name_and_ipv4() {
        let info = parse_status(SAMPLE).expect("parse sample status");
        assert_eq!(info.dns_name, "codexia-mac.tail1234.ts.net");
        assert_eq!(info.ipv4, "100.101.102.103");
    }

    #[test]
    fn prefers_ipv4_over_ipv6() {
        let raw = r#"{"Self":{"DNSName":"a.ts.net.","TailscaleIPs":["fd7a::1","100.1.2.3"]}}"#;
        assert_eq!(parse_status(raw).expect("parse").ipv4, "100.1.2.3");
    }

    #[test]
    fn returns_none_when_logged_out_or_incomplete() {
        assert!(parse_status("{}").is_none());
        assert!(parse_status(r#"{"Self":{}}"#).is_none());
        assert!(parse_status(r#"{"Self":{"DNSName":"","TailscaleIPs":["100.1.2.3"]}}"#).is_none());
        assert!(parse_status(r#"{"Self":{"DNSName":"a.ts.net.","TailscaleIPs":[]}}"#).is_none());
        assert!(parse_status(r#"{"Self":{"DNSName":"a.ts.net.","TailscaleIPs":["fd7a::1"]}}"#).is_none());
        assert!(parse_status("not json").is_none());
    }
}
