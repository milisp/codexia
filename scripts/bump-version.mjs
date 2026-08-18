#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+([.-][0-9A-Za-z.-]+)?$/.test(version)) {
	console.error("Usage: bun run bump-version <version>  (e.g. 1.2.3)");
	process.exit(1);
}

const url = (p) => new URL(p, import.meta.url);
const read = (p) => readFileSync(url(p), "utf8");

const pkg = JSON.parse(read("../package.json"));
pkg.version = version;
writeFileSync(url("../package.json"), `${JSON.stringify(pkg, null, 2)}\n`);

// Root Cargo.toml: only the version inside [workspace.package]
const cargo = read("../Cargo.toml");
const cargoRe = /(\[workspace\.package\][^[]*?\nversion = ")[^"]*(")/;
if (!cargoRe.test(cargo)) {
	console.error("Could not find version in [workspace.package] of Cargo.toml");
	process.exit(1);
}
writeFileSync(url("../Cargo.toml"), cargo.replace(cargoRe, `$1${version}$2`));

// Cargo.lock: keep workspace member entries in sync (avoids a full cargo resolve)
const members = [
	"codexia",
	"codexia-acp",
	"codexia-automation",
	"codexia-cc",
	"codexia-codex",
	"codexia-db",
	"codexia-git",
	"codexia-shared",
	"codexia-web",
];
let lock = read("../Cargo.lock");
for (const name of members) {
	lock = lock.replace(
		new RegExp(`(name = "${name}"\\nversion = ")[^"]*(")`),
		`$1${version}$2`,
	);
}
writeFileSync(url("../Cargo.lock"), lock);

execFileSync("git", ["add", "package.json", "Cargo.toml", "Cargo.lock"], {
	stdio: "inherit",
});
console.log(`Version set to ${version}`);
