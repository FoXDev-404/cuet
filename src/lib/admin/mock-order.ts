/**
 * Pure section/question ordering for the mockbuilder. Section order is
 * authoritative; questions within a section keep the order they were
 * submitted in. Unknown sections follow the named sections in their original
 * relative order.
 */
export function orderQuestionsBySections<T extends { section: string }>(
  questions: T[],
  sectionOrder: string[],
): T[] {
  const rank = new Map<string, number>();
  for (const section of sectionOrder) {
    if (!rank.has(section)) rank.set(section, rank.size);
  }
  const fallback = rank.size;
  return questions
    .map((question, index) => ({ question, index }))
    .sort((left, right) => {
      const leftRank = rank.get(left.question.section) ?? fallback;
      const rightRank = rank.get(right.question.section) ?? fallback;
      return leftRank - rightRank || left.index - right.index;
    })
    .map((entry) => entry.question);
}
