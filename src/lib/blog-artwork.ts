import type { GuideCategory } from "../content/guides/types";

const CATEGORY_COLORS: Record<GuideCategory, { background: string; accent: string; tint: string }> = {
  "exam-basics": { background: "#eef6ff", accent: "#2563eb", tint: "#bfdbfe" },
  practice: { background: "#f0fdf4", accent: "#15803d", tint: "#bbf7d0" },
  "subject-strategy": { background: "#f5f3ff", accent: "#7c3aed", tint: "#ddd6fe" },
  "exam-day": { background: "#fff7ed", accent: "#c2410c", tint: "#fed7aa" },
};

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&apos;",
    };
    return entities[character];
  });
}

function wrapTitle(title: string, maxLineLength = 24): string[] {
  const words = title.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length > maxLineLength && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);

  if (lines.length > 3) {
    lines[2] = `${lines.slice(2).join(" ").slice(0, 40).trimEnd()}…`;
    lines.length = 3;
  }
  return lines;
}

export function blogArtworkSvg(title: string, category: GuideCategory): string {
  const colors = CATEGORY_COLORS[category];
  const titleLines = wrapTitle(title).map(
    (line, index) =>
      `<tspan x="84" dy="${index === 0 ? 0 : 66}">${escapeXml(line)}</tspan>`,
  );
  const safeTitle = escapeXml(title.trim());

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-labelledby="title description">
  <title id="title">${safeTitle}</title>
  <desc id="description">CUET UG study guide illustration with a checklist, study notes and progress chart.</desc>
  <rect width="1200" height="630" rx="32" fill="${colors.background}"/>
  <circle cx="1124" cy="82" r="176" fill="${colors.tint}" opacity=".55"/>
  <circle cx="1100" cy="566" r="120" fill="${colors.tint}" opacity=".4"/>
  <path d="M0 520c205-88 363 104 598 10s411-3 602 67v33H0z" fill="#fff" opacity=".58"/>
  <text x="84" y="92" fill="${colors.accent}" font-family="Arial,sans-serif" font-size="21" font-weight="700" letter-spacing="3">CUET UG STUDY GUIDE</text>
  <text x="84" y="190" fill="#172554" font-family="Arial,sans-serif" font-size="54" font-weight="700">${titleLines.join("")}</text>
  <text x="84" y="424" fill="#475569" font-family="Arial,sans-serif" font-size="22">Plan your preparation. Practise with purpose.</text>
  <rect x="836" y="112" width="260" height="370" rx="24" fill="#fff" opacity=".94"/>
  <rect x="866" y="146" width="132" height="14" rx="7" fill="${colors.tint}"/>
  <rect x="866" y="180" width="196" height="10" rx="5" fill="#e2e8f0"/>
  <rect x="866" y="204" width="166" height="10" rx="5" fill="#e2e8f0"/>
  <rect x="866" y="252" width="26" height="26" rx="7" fill="${colors.accent}"/>
  <path d="m873 265 6 6 11-13" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  <rect x="906" y="260" width="144" height="10" rx="5" fill="#cbd5e1"/>
  <rect x="866" y="298" width="26" height="26" rx="7" fill="${colors.accent}"/>
  <path d="m873 311 6 6 11-13" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  <rect x="906" y="306" width="124" height="10" rx="5" fill="#cbd5e1"/>
  <rect x="866" y="366" width="24" height="70" rx="8" fill="${colors.tint}"/>
  <rect x="903" y="342" width="24" height="94" rx="8" fill="${colors.accent}" opacity=".78"/>
  <rect x="940" y="322" width="24" height="114" rx="8" fill="${colors.accent}"/>
  <path d="m978 365 30-28 25 12 27-38" fill="none" stroke="${colors.accent}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="1060" cy="311" r="8" fill="${colors.accent}"/>
  <rect x="1010" y="490" width="116" height="52" rx="18" fill="${colors.accent}"/>
  <path d="m1041 516 12 12 26-28" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
}
