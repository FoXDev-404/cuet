/**
 * Safety gate for the seed practice-library importer.
 *
 * The importer replaces every question and passage row for the 245 bundled
 * papers. Once the 50-question PYQ rebuild has archived 231 of those papers,
 * re-seeding them would overwrite retained content and can resurrect URLs that
 * are supposed to stay permanent redirects. Refuse unless the operator opts in
 * explicitly.
 */
export function archiveGuardDecision(archivedCount, allowReset) {
  if (allowReset) {
    return {
      blocked: false,
      archivedCount: Number.isFinite(Number(archivedCount)) ? Number(archivedCount) : null,
      message: null,
    };
  }

  if (archivedCount === null || archivedCount === undefined) {
    return {
      blocked: true,
      archivedCount: null,
      message:
        "Refusing to reimport: could not verify whether archived practice papers exist. " +
        "Re-run with --allow-archive-reset only if you intend to reset the archive.",
    };
  }

  const count = Number(archivedCount);
  if (!Number.isFinite(count) || count < 0) {
    return {
      blocked: true,
      archivedCount: null,
      message:
        "Refusing to reimport: the archived-paper count was not a valid number. " +
        "Re-run with --allow-archive-reset only if you intend to reset the archive.",
    };
  }

  if (count > 0) {
    return {
      blocked: true,
      archivedCount: count,
      message:
        `Refusing to reimport: ${count} archived practice paper(s) exist. ` +
        "This importer replaces seed question and passage rows and must not run over the PYQ rebuild. " +
        "Re-run with --allow-archive-reset only if you intend to reset the archive.",
    };
  }

  return { blocked: false, archivedCount: 0, message: null };
}
