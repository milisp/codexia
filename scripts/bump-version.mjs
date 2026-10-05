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
const cwd = url("../");
const run = (command, args) => execFileSync(command, args, { cwd, stdio: "inherit" });

if (execFileSync("git", ["status", "--porcelain"], { cwd, encoding: "utf8" }).trim()) {
	console.error("Working tree is dirty, commit or stash first");
	process.exit(1);
}
const tag = `v${version}`;
const tags = execFileSync("git", ["tag", "--list", tag], { cwd, encoding: "utf8" });
if (tags.trim()) {
	console.error(`Tag ${tag} already exists`);
	process.exit(1);
}

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

run("cargo", ["update", "--workspace"]);

run("git", ["add", "package.json", "Cargo.toml", "Cargo.lock"]);
run("git", ["commit", "-m", `chore: bump version to ${version}`]);
run("git", ["tag", tag]);
console.log(`Bumped to ${version} and tagged ${tag}`);
console.log(`Push with: git push origin HEAD ${tag}`);
