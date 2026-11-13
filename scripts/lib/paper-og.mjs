/**
 * Satori/Resvg renderer for per-paper Open Graph images.
 *
 * Same offline pipeline as the per-question OG cards (never imported by the
 * Worker bundle): scripts/generate-paper-og.mjs renders one 1200x630 card per
 * practice paper so /mock-tests/{slug} pages share a real preview instead of
 * the generic logo.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import { createElement as h } from "satori/jsx";

export const PAPER_OG_WIDTH = 1200;
export const PAPER_OG_HEIGHT = 630;

const BRAND = "#1d4ed8";
const INK = "#0f172a";
const MUTED = "#64748b";
const LINE = "#e2e8f0";
const TINT = "#eff6ff";
const FONT_FAMILY = "Inter, 'Noto Sans Devanagari', sans-serif";

export function loadPaperOgFonts(root) {
  return [
    {
      name: "Inter",
      data: readFileSync(join(root, "node_modules/@fontsource/inter/files/inter-latin-400-normal.woff")),
      weight: 400,
      style: "normal",
    },
    {
      name: "Inter",
      data: readFileSync(join(root, "node_modules/@fontsource/inter/files/inter-latin-700-normal.woff")),
      weight: 700,
      style: "normal",
    },
    {
      name: "Inter",
      data: readFileSync(join(root, "node_modules/@fontsource/inter/files/inter-latin-800-normal.woff")),
      weight: 800,
      style: "normal",
    },
    {
      name: "Noto Sans Devanagari",
      data: readFileSync(
        join(
          root,
          "node_modules/@fontsource/noto-sans-devanagari/files/noto-sans-devanagari-devanagari-400-normal.woff",
        ),
      ),
      weight: 400,
      style: "normal",
    },
  ];
}

/** Clamps a long paper title onto word boundaries. */
function paperTitle(value, maxChars = 96) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (text.length <= maxChars) return text;
  const clipped = text.slice(0, maxChars);
  const lastSpace = clipped.lastIndexOf(" ");
  return `${clipped.slice(0, lastSpace > maxChars * 0.6 ? lastSpace : clipped.length).trimEnd()}…`;
}

export function paperOgCard(paper) {
  const title = paperTitle(paper.title);
  const eyebrow = ["CUET UG", paper.subject?.name, paper.year ? `PYQ ${paper.year}` : null]
    .filter(Boolean)
    .join("  ·  ");
  const meta = [
    `${paper.rankedQuestionCount ?? paper.questionCount} questions`,
    (paper.rankedDurationMinutes ?? paper.durationMinutes)
      ? `${paper.rankedDurationMinutes ?? paper.durationMinutes} min`
      : null,
    "Free ranked mock",
  ]
    .filter(Boolean)
    .join("  ·  ");

  return h(
    "div",
    {
      style: {
        width: `${PAPER_OG_WIDTH}px`,
        height: `${PAPER_OG_HEIGHT}px`,
        display: "flex",
        flexDirection: "column",
        background: "#ffffff",
        fontFamily: FONT_FAMILY,
        color: INK,
      },
    },
    h("div", {
      style: {
        height: "12px",
        width: "100%",
        background: `linear-gradient(90deg, ${BRAND} 0%, #3b82f6 100%)`,
      },
    }),
    h(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "column",
          flex: 1,
          padding: "36px 56px 28px",
        },
      },
      h(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          },
        },
        h(
          "div",
          { style: { display: "flex", alignItems: "center", gap: "14px" } },
          h(
            "div",
            {
              style: {
                width: "52px",
                height: "52px",
                borderRadius: "14px",
                background: BRAND,
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "24px",
                fontWeight: 700,
              },
            },
            "CF",
          ),
          h(
            "div",
            { style: { display: "flex", flexDirection: "column" } },
            h(
              "div",
              { style: { fontSize: "24px", fontWeight: 700, lineHeight: 1.2 } },
              "CUET Free Mock Test",
            ),
            h(
              "div",
              { style: { fontSize: "16px", color: MUTED, marginTop: "3px" } },
              "Free CUET UG practice",
            ),
          ),
        ),
        h(
          "div",
          {
            style: {
              display: "flex",
              background: TINT,
              color: BRAND,
              fontSize: "16px",
              fontWeight: 700,
              padding: "10px 18px",
              borderRadius: "999px",
            },
          },
          "Previous year paper",
        ),
      ),
      h(
        "div",
        {
          style: {
            display: "flex",
            marginTop: "28px",
            fontSize: "19px",
            fontWeight: 700,
            color: BRAND,
            letterSpacing: "0.01em",
          },
        },
        eyebrow,
      ),
      h(
        "div",
        {
          style: {
            display: "flex",
            marginTop: "14px",
            fontSize: title.length > 72 ? "34px" : "40px",
            fontWeight: 800,
            lineHeight: 1.3,
            color: INK,
            maxHeight: "200px",
            overflow: "hidden",
          },
        },
        title,
      ),
      h(
        "div",
        {
          style: {
            display: "flex",
            marginTop: "22px",
            fontSize: "20px",
            fontWeight: 600,
            color: MUTED,
            gap: "10px",
          },
        },
        meta,
      ),
    ),
    h("div", { style: { height: "1px", background: LINE, margin: "0 56px" } }),
    h(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "20px 56px 26px",
        },
      },
      h(
        "div",
        { style: { display: "flex", flexDirection: "column" } },
        h(
          "div",
          { style: { fontSize: "20px", fontWeight: 700, color: BRAND } },
          "cuetfreemocktest.com/mock-tests",
        ),
        h(
          "div",
          { style: { fontSize: "15px", color: MUTED, marginTop: "4px" } },
          "Attempt with instant scoring and a leaderboard",
        ),
      ),
    ),
  );
}

export async function renderPaperOgPng(paper, fonts) {
  const svg = await satori(paperOgCard(paper), {
    width: PAPER_OG_WIDTH,
    height: PAPER_OG_HEIGHT,
    fonts,
  });
  return new Resvg(svg, {
    fitTo: { mode: "width", value: PAPER_OG_WIDTH },
  })
    .render()
    .asPng();
}
