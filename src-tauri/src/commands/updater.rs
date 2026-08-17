/// True when this app was installed by `brew install --cask codexia`.
/// Homebrew owns the bundle, so the in-app updater must not touch it —
/// the user upgrades with `brew upgrade --cask codexia` instead.
#[tauri::command]
pub async fn is_homebrew_install() -> bool {
    ["/opt/homebrew/Caskroom/codexia", "/usr/local/Caskroom/codexia"]
        .iter()
        .any(|path| std::path::Path::new(path).is_dir())
}
