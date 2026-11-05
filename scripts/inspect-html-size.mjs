import { readFileSync } from "node:fs";

async function inspectHtml() {
  const res = await fetch("http://localhost:4321/mock-tests");
  const html = await res.text();
  console.log("Total bytes:", Buffer.byteLength(html));
  
  // Breakdown
  const headMatch = html.match(/<head[\s\S]*?<\/head>/i);
  console.log("Head bytes:", headMatch ? Buffer.byteLength(headMatch[0]) : 0);

  const navMatch = html.match(/<header[\s\S]*?<\/header>/i);
  console.log("Header bytes:", navMatch ? Buffer.byteLength(navMatch[0]) : 0);

  const footerMatch = html.match(/<footer[\s\S]*?<\/footer>/i);
  console.log("Footer bytes:", footerMatch ? Buffer.byteLength(footerMatch[0]) : 0);

  const scripts = html.match(/<script[\s\S]*?<\/script>/gi) || [];
  const scriptBytes = scripts.reduce((sum, s) => sum + Buffer.byteLength(s), 0);
  console.log("Script tags count:", scripts.length, "Total script bytes:", scriptBytes);

  // Check SVG size
  const svgs = html.match(/<svg[\s\S]*?<\/svg>/gi) || [];
  const svgBytes = svgs.reduce((sum, s) => sum + Buffer.byteLength(s), 0);
  console.log("SVG tags count:", svgs.length, "Total SVG bytes:", svgBytes);

  // Check if there are large data attributes or JSON
  const jsonMatches = html.match(/<script type="application\/ld\+json"[\s\S]*?<\/script>/gi) || [];
  console.log("JSON-LD bytes:", jsonMatches.reduce((sum, s) => sum + Buffer.byteLength(s), 0));

  // Check if anything else is large
  console.log("Remaining body without header/footer/head:", 
    Buffer.byteLength(html) - (headMatch ? Buffer.byteLength(headMatch[0]) : 0) - (navMatch ? Buffer.byteLength(navMatch[0]) : 0) - (footerMatch ? Buffer.byteLength(footerMatch[0]) : 0)
  );
}

inspectHtml().catch(console.error);

