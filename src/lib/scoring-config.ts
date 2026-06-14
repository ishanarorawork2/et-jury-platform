// Central scoring configuration. Single source for thresholds and bounds so no
// screen hard-codes them. Server pages read these and pass divergenceThreshold
// to client components as a prop (keeps the value swappable without a rebuild of
// every consumer).

/** Score scale bounds for every rubric criterion and the derived total. */
export const SCORE_MIN = 0
export const SCORE_MAX = 100

/**
 * Advisory divergence threshold: when the two jurors' totals differ by at least
 * this many points, the nomination is flagged for review. Advisory only — never
 * blocks finalization. Replaces the old hard-coded `>= 15` in ResultsBrowser.
 */
export const DIVERGENCE_THRESHOLD = 20
