#!/usr/bin/env node
/**
 * Build and deploy the SEPARATE staging Worker.
 *
 *   npm run deploy:staging
 *
 * This targets `env.staging` in wrangler.jsonc (`cuet-astro-staging` and the
 * `cuet-d1-staging` database). It never touches the production `cuet-astro`
 * Worker or `cuet-blueprint-db`.
 */
import { spawnSync } from "node:child_process";

const env = { ...process.env, CLOUDFLARE_ENV: "staging" };

function run(command, args) {
  const windows = process.platform === "win32";
  const executable = windows ? process.env.ComSpec || "cmd.exe" : command;
  const finalArgs = windows ? ["/d", "/s", "/c", `${command} ${args.join(" ")}`] : args;
  const result = spawnSync(executable, finalArgs, { stdio: "inherit", env });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log("Building with CLOUDFLARE_ENV=staging...");
run("npm", ["run", "build"]);
console.log("Deploying cuet-astro-staging with the staging configuration...");
run("npx", ["wrangler", "deploy"]);
