import { spawn } from "node:child_process";

async function measureProd() {
  console.log("Starting wrangler dev on port 8788 against dist/...");
  const child = spawn("npx", ["wrangler", "dev", "--port", "8788"], {
    stdio: "pipe",
    shell: true,
  });

  // wait for server
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch("http://localhost:8788/mock-tests");
      if (res.status === 200) {
        const html = await res.text();
        const bytes = Buffer.byteLength(html, "utf8");
        console.log(`[Production Build] /mock-tests HTML Size: ${bytes} bytes (${(bytes / 1024).toFixed(2)} KB)`);
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }

  child.kill();
  process.exit(0);
}

measureProd().catch(console.error);

