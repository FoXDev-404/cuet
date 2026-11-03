/**
 * Satori/Resvg renderer for per-question Open Graph images.
 *
 * This module is imported only by the offline generator script, never by the
 * Worker bundle. It is kept separate so the card can be rendered in a test or
 * a design preview without touching D1.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import { createElement as h } from "satori/jsx";

export const QUESTION_OG_WIDTH = 1200;
export const QUESTION_OG_HEIGHT = 630;

const BRAND = "#1d4ed8";
const INK = "#0f172a";
const MUTED = "#64748b";
const LINE = "#e2e8f0";
const TINT = "#eff6ff";
const FONT_FAMILY = "Inter, 'Noto Sans Devanagari', sans-serif";

export function loadQuestionOgFonts(root) {
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
    {
      name: "Noto Sans Devanagari",
      data: readFileSync(
        join(
          root,
          "node_modules/@fontsource/noto-sans-devanagari/files/noto-sans-devanagari-devanagari-700-normal.woff",
        ),
      ),
      weight: 700,
      style: "normal",
    },
  ];
}

/** Flattens markdown/rich text into one plain paragraph for the card. */
export function plainCardText(value, maxChars = 260) {
  const text = String(value ?? "")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\$\$([^$]+)\$\$/g, " $1 ")
    .replace(/\$([^$]+)\$/g, " $1 ")
    .replace(/\\[a-zA-Z]+/g, " ")
    .replace(/[{}]/g, "")
    .replace(/[*_`#>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= maxChars) return text;
  const clipped = text.slice(0, maxChars);
  const lastSpace = clipped.lastIndexOf(" ");
  return `${clipped.slice(0, lastSpace > maxChars * 0.6 ? lastSpace : clipped.length).trimEnd()}…`;
}

export function questionOgCard({ publicId, text, subjectName, year }) {
  const questionText = plainCardText(text);
  const subjectLine = ["CUET UG", subjectName, year ? `PYQ ${year}` : null]
    .filter(Boolean)
    .join("  ·  ");

  return h(
    "div",
    {
      style: {
        width: `${QUESTION_OG_WIDTH}px`,
        height: `${QUESTION_OG_HEIGHT}px`,
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
          padding: "40px 56px 32px",
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
          "Practice question",
        ),
      ),
      h(
        "div",
        {
          style: {
            display: "flex",
            marginTop: "30px",
            fontSize: "19px",
            fontWeight: 700,
            color: BRAND,
            letterSpacing: "0.01em",
          },
        },
        subjectLine,
      ),
      h(
        "div",
        {
          style: {
            display: "flex",
            marginTop: "16px",
            fontSize: questionText.length > 190 ? "31px" : "36px",
            fontWeight: 700,
            lineHeight: 1.34,
            color: INK,
            maxHeight: "262px",
            overflow: "hidden",
          },
        },
        questionText,
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
          padding: "22px 56px 28px",
        },
      },
      h(
        "div",
        { style: { display: "flex", flexDirection: "column" } },
        h(
          "div",
          { style: { fontSize: "20px", fontWeight: 700, color: BRAND } },
          `cuetfreemocktest.com/q/${publicId}`,
        ),
        h(
          "div",
          { style: { fontSize: "15px", color: MUTED, marginTop: "4px" } },
          "Free CUET mock tests",
        ),
      ),
      h(
        "div",
        { style: { fontSize: "15px", color: MUTED } },
        "Not affiliated with NTA",
      ),
    ),
  );
}

export async function renderQuestionOgPng(question, fonts) {
  const svg = await satori(questionOgCard(question), {
    width: QUESTION_OG_WIDTH,
    height: QUESTION_OG_HEIGHT,
    fonts,
  });
  return new Resvg(svg, {
    fitTo: { mode: "width", value: QUESTION_OG_WIDTH },
  })
    .render()
    .asPng();
}
