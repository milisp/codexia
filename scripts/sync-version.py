#!/usr/bin/env python3
import json
import re
import sys
import os

def main():
    if len(sys.argv) != 2:
        print(f"Usage: {sys.argv[0]} <version>")
        print("Example: {} 0.24.0".format(sys.argv[0]))
        sys.exit(1)

    new_version = sys.argv[1]

    # Basic version format check: 1.2.3 or 1.2.3-beta.1
    if not re.match(r'^[0-9]+\.[0-9]+\.[0-9]+([.-][0-9A-Za-z.-]+)?$', new_version):
        print(f"Error: invalid version format: {new_version}")
        print("Expected format like: 1.2.3 or 1.2.3-beta.1")
        sys.exit(1)

    root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    package_json = os.path.join(root_dir, "package.json")
    root_cargo_toml = os.path.join(root_dir, "Cargo.toml")
    info_plist = os.path.join(root_dir, "src-tauri", "Info.plist")

    for f in [package_json, root_cargo_toml, info_plist]:
        if not os.path.exists(f):
            print(f"Error: file not found: {f}")
            sys.exit(1)

    # Update package.json
    with open(package_json, 'r') as f:
        data = json.load(f)
    data['version'] = new_version
    with open(package_json, 'w') as f:
        json.dump(data, f, indent=2)
    print(f"Updated {package_json}")

    # Update root Cargo.toml [workspace.package] section
    with open(root_cargo_toml, 'r') as f:
        lines = f.readlines()

    in_workspace_package = False
    updated = False
    for i, line in enumerate(lines):
        stripped = line.strip()
        if stripped == '[workspace.package]':
            in_workspace_package = True
            continue
        if stripped.startswith('[') and stripped != '[workspace.package]':
            in_workspace_package = False
        if in_workspace_package and stripped.startswith('version =') and not updated:
            lines[i] = f'version = "{new_version}"\n'
            updated = True
            break

    if not updated:
        print(f"Error: Could not find version line in [workspace.package] section of {root_cargo_toml}")
        sys.exit(1)

    with open(root_cargo_toml, 'w') as f:
        f.writelines(lines)
    print(f"Updated {root_cargo_toml}")

    # Update Info.plist
    with open(info_plist, 'r') as f:
        lines = f.readlines()

    saw_key = False
    updated = False
    for i, line in enumerate(lines):
        stripped = line.strip()
        if stripped == '<key>CFBundleShortVersionString</key>':
            saw_key = True
            continue
        if saw_key and stripped.startswith('<string>') and stripped.endswith('</string>') and not updated:
            # Replace the content between <string> and </string>
            lines[i] = f'  <string>{new_version}</string>\n'
            saw_key = False
            updated = True
            break

    if not updated:
        print(f"Error: Could not find CFBundleShortVersionString string in {info_plist}")
        sys.exit(1)

    with open(info_plist, 'w') as f:
        f.writelines(lines)
    print(f"Updated {info_plist}")

    print(f"\nVersion updated to {new_version} in:")
    print(f"- package.json")
    print(f"- Cargo.toml")
    print(f"- src-tauri/Info.plist")

if __name__ == '__main__':
    main()