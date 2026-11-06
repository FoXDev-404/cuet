#!/usr/bin/env node
/**
 * Build and deploy the separate `cuet-2026` Worker (env.deploy2026).
 *
 *   npm run deploy:2026
 *
 * This environment has its own Worker, D1 database and KV namespaces in the
 * owner's account. It does not touch `cuet-astro` or `cuet-blueprint-db`.
 */
import { spawnSync } from "node:child_process";

const env = { ...process.env, CLOUDFLARE_ENV: "deploy2026" };

function run(command, args) {
  const windows = process.platform === "win32";
  const executable = windows ? process.env.ComSpec || "cmd.exe" : command;
  const finalArgs = windows ? ["/d", "/s", "/c", `${command} ${args.join(" ")}`] : args;
  const result = spawnSync(executable, finalArgs, { stdio: "inherit", env });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log("Building with CLOUDFLARE_ENV=deploy2026...");
run("npm", ["run", "build"]);
console.log("Deploying cuet-2026 with the deploy2026 configuration...");
run("npx", ["wrangler", "deploy", "--env", "deploy2026"]);
