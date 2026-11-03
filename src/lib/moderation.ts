/** Comments from members with at least this many approved comments skip the queue. */
export const AUTO_APPROVE_COMMENT_COUNT = 3;

export function isTrustedContributor(approvedComments: number): boolean {
  return Number.isFinite(approvedComments) && approvedComments >= AUTO_APPROVE_COMMENT_COUNT;
}

export function commentStatusFor(approvedComments: number): "visible" | "pending" {
  return isTrustedContributor(approvedComments) ? "visible" : "pending";
}
