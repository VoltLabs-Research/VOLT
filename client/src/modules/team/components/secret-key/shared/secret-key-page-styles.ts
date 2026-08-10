/**
 * The class vocabulary `SecretKeyShared.css` and `SecretKeyUsage.css` used to own,
 * shared by the two secret-key pages and their loading skeletons.
 *
 * Every value is a complete static literal so Tailwind's scanner can see it, and the
 * colours are converted by token rather than by name: `--glass-border` and
 * `--color-border-soft` are both HeroUI's `--border`, `--hover-bg` is
 * `--surface-hover`, `--shadow-elevated` is `--overlay-shadow` (`shadow-overlay`),
 * `--color-text-muted` is `--muted` and `--accent-blue` is `--accent`.
 */

/**
 * `.secret-key-page`. The old rule was `overflow: scroll; height: 100% !important`,
 * and the `!important` beat the `h-dvh` the markup also carried — so the effective
 * height was always 100% and `h-full` alone reproduces it without the override.
 */
export const SECRET_KEY_PAGE_CLASS = 'h-full overflow-scroll text-foreground';

/** `.secret-key-page-main` and its two padding steps (`1rem 2rem`, then `1rem 3rem`). */
export const SECRET_KEY_PAGE_MAIN_CLASS = 'flex flex-col gap-8 w-full max-w-[1600px] mx-auto md:py-4 md:px-8 min-[1440px]:px-12';

/** `.secret-key-page-cards` — 1 column, 2 from `md`, 4 from `lg`. */
export const SECRET_KEY_PAGE_CARDS_CLASS = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4';

/** `.secret-key-page-charts` — 1 column, 2 from `md`, and a wider gap from 1440px. */
export const SECRET_KEY_PAGE_CHARTS_CLASS = 'grid grid-cols-1 md:grid-cols-2 gap-6 min-[1440px]:gap-8';

/** `.secret-key-page-card` plus its hover fill and elevation. */
export const SECRET_KEY_PAGE_CARD_CLASS = 'border border-border p-5 rounded-2xl transition-[all] duration-200 ease-out-fluid hover:bg-surface-hover hover:shadow-overlay';

/** `.secret-key-page-table` */
export const SECRET_KEY_TABLE_CLASS = 'w-full border-collapse';

/**
 * `.secret-key-page-table tr` — the `tr:hover td { background: var(--hover-bg) }` rule
 * moves onto the row, since the cells are transparent and the row shows through, and
 * `tr:last-child td { border-bottom: none }` becomes a child variant on the row.
 */
export const SECRET_KEY_TABLE_ROW_CLASS = 'transition-colors hover:bg-surface-hover last:[&>td]:border-b-0';

/** `.secret-key-page-table th` */
export const SECRET_KEY_TABLE_HEAD_CELL_CLASS = 'px-4 py-3 text-left border-b border-border text-xs font-semibold uppercase tracking-[0.05em] text-muted';

/** `.secret-key-page-table td` */
export const SECRET_KEY_TABLE_CELL_CLASS = 'px-4 py-3 text-left border-b border-border text-sm';

/** `.secret-key-usage-back` and its hover / focus-visible accent. */
export const SECRET_KEY_USAGE_BACK_CLASS = 'min-h-10 hover:text-accent focus-visible:text-accent';
