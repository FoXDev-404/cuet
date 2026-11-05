#!/usr/bin/env node
/**
 * Build and deploy the live worker with the production Wrangler environment.
 *
 * The Astro Cloudflare adapter reads CLOUDFLARE_ENV while building and writes
 * the resolved name, vars and bindings into dist/server/wrangler.json. Plain
 * `wrangler deploy` then uploads that generated configuration, so the live
 * worker gets env.production without changing the top-level values that local
 * development and Playwright rely on.
 */
import { spawnSync } from "node:child_process";

const env = { ...process.env, CLOUDFLARE_ENV: "production" };

function run(command, args) {
  // Spawn cmd.exe explicitly on Windows so npm/npx .cmd shims work without
  // passing `shell: true` (which Node now warns about).
  const windows = process.platform === "win32";
  const executable = windows ? process.env.ComSpec || "cmd.exe" : command;
  const finalArgs = windows ? ["/d", "/s", "/c", `${command} ${args.join(" ")}`] : args;
  const result = spawnSync(executable, finalArgs, { stdio: "inherit", env });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log("Building with CLOUDFLARE_ENV=production...");
run("npm", ["run", "build"]);
console.log("Deploying cuet-astro with the production configuration...");
run("npx", ["wrangler", "deploy"]);
