/** Pure gates for subject and syllabus URLs in `/sitemap.xml`. */

export type SitemapSubjectStat = {
  id: number;
  slug: string;
  exam_slug: string;
  /** Questions attached to a published, non-practice mock. */
  bank_question_count: number;
  /** Published non-practice mocks covering the subject. */
  mock_count: number;
};

/**
 * Subject hubs are indexable only when they have timed bank content or a
 * listable local paper. Practice-paper wrapper counts are deliberately ignored:
 * archived wrappers would otherwise keep a noindex hub in the sitemap.
 */
export function sitemapSubjectPaths(
  stats: SitemapSubjectStat[],
  localSubjectSlugs: Set<string>,
  noindexPaths: Set<string>,
): string[] {
  return stats
    .filter((subject) => subject.exam_slug === "cuet-ug")
    .filter(
      (subject) =>
        subject.bank_question_count > 0 ||
        subject.mock_count > 0 ||
        localSubjectSlugs.has(subject.slug),
    )
    .map((subject) => `/cuet-mock-test/${subject.slug}`)
    .filter((path) => !noindexPaths.has(path));
}

/**
 * The syllabus route returns 404 when a subject has no topics and no timed
 * content. Match that rule exactly instead of listing a URL that will 404.
 */
export function sitemapSyllabusPaths(
  stats: SitemapSubjectStat[],
  topicCounts: Map<number, number>,
  localSubjectSlugs: Set<string>,
  noindexPaths: Set<string>,
): string[] {
  return stats
    .filter((subject) => subject.exam_slug === "cuet-ug")
    .filter(
      (subject) =>
        (topicCounts.get(subject.id) ?? 0) > 0 ||
        subject.bank_question_count > 0 ||
        localSubjectSlugs.has(subject.slug),
    )
    .map((subject) => `/cuet-ug-syllabus/${subject.slug}`)
    .filter((path) => !noindexPaths.has(path));
}
