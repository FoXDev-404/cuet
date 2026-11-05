import { spawn } from "node:child_process";

async function inspectProd() {
  const child = spawn("npx", ["wrangler", "dev", "--port", "8789"], {
    stdio: "pipe",
    shell: true,
  });

  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch("http://localhost:8789/mock-tests");
      if (res.status === 200) {
        const html = await res.text();
        console.log("Total bytes:", Buffer.byteLength(html));
        
        const head = html.match(/<head[\s\S]*?<\/head>/i)?.[0] || "";
        console.log("Head bytes:", Buffer.byteLength(head));

        const nav = html.match(/<header[\s\S]*?<\/header>/i)?.[0] || "";
        console.log("Header bytes:", Buffer.byteLength(nav));

        const footer = html.match(/<footer[\s\S]*?<\/footer>/i)?.[0] || "";
        console.log("Footer bytes:", Buffer.byteLength(footer));

        const main = html.match(/<main[\s\S]*?<\/main>/i)?.[0] || "";
        console.log("Main bytes:", Buffer.byteLength(main));

        const rows = html.match(/<article[\s\S]*?<\/article>/gi) || [];
        console.log("Articles count:", rows.length, "Total articles bytes:", rows.reduce((s, r) => s + Buffer.byteLength(r), 0));

        // check mobile bottom sheet inside PaperFilters
        const sheet = html.match(/<div id="mobile-filters-sheet"[\s\S]*?<\/form>\s*<\/div>\s*<\/div>/i)?.[0] || "";
        console.log("Mobile filters sheet bytes:", Buffer.byteLength(sheet));
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }

  child.kill();
  process.exit(0);
}

inspectProd().catch(console.error);

