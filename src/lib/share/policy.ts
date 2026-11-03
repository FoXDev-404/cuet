/**
 * Pure sharing policy checks. No database imports, so the rules can be tested
 * and reused by the admin API and the later public page.
 */

export type RevealPolicy = "attempted_only" | "public";

export type SharePolicyFlags = {
  shareEnabled: boolean;
  revealPolicy: RevealPolicy;
  seoIndexable: boolean;
  rightsOk: boolean;
};

export type ShareBlockers = {
  shareEnabled: string[];
  publicReveal: string[];
  seoIndexable: string[];
};

export function seoBlockers(info: {
  publishedRevisionId: number | null;
  hasExplanation: boolean;
  inPublishedMock: boolean;
  flags: SharePolicyFlags;
}): string[] {
  const blockers: string[] = [];
  if (!info.publishedRevisionId) blockers.push("Publish the question first.");
  if (!info.flags.rightsOk) blockers.push("Confirm the rights to share this question.");
  if (info.flags.revealPolicy !== "public") {
    blockers.push("Set the reveal policy to public; attempted-only pages are not indexable.");
  }
  if (!info.hasExplanation) {
    blockers.push("The published question needs an original explanation.");
  }
  if (info.inPublishedMock) {
    blockers.push("This question is in a currently published ranked mock.");
  }
  return blockers;
}

export function publicRevealBlockers(info: {
  publishedRevisionId: number | null;
  inPublishedMock: boolean;
}): string[] {
  const blockers: string[] = [];
  if (!info.publishedRevisionId) blockers.push("Publish the question before revealing answers publicly.");
  if (info.inPublishedMock) {
    blockers.push("Questions in a currently published ranked mock cannot reveal answers publicly.");
  }
  return blockers;
}

export function shareEnabledBlockers(info: { isPyq: boolean; rightsOk: boolean }): string[] {
  if (info.isPyq && !info.rightsOk) {
    return ["Confirm PYQ rights before enabling sharing."];
  }
  return [];
}
