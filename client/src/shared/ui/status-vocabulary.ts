/**
 * VOLT's status vocabulary: which status strings read as success, warning, danger
 * or neutral, and what colour each of those is.
 *
 * This is a data module on purpose, not a component. HeroUI has nothing that maps
 * a domain's status strings onto tones — that mapping is VOLT's — while the badge
 * itself is a `<span>` plus utilities and needs no component at all.
 *
 * Two things here are NOT self-evident and are bravais's behaviour verbatim,
 * carried over deliberately rather than rationalised:
 *
 *   - `status='active'` resolves to **success** (green), whereas the old
 *     `variant='active'` was blue. They are different axes with a colliding name.
 *   - `status='running'` resolves to `active`, which under the monochrome accent
 *     (spec §3a) lands on the plain foreground rather than on a hue.
 *
 * `uppercase` is the quiet one: it lived only in `.status-badge`'s CSS, so the DOM
 * text keeps the caller's original casing. Call sites pass `'running'` and read
 * `RUNNING`; dropping `uppercase` would silently lowercase every badge in the app.
 */

export type StatusVariant =
    | 'active' | 'inactive' | 'danger' | 'neutral'
    | 'success' | 'warning' | 'brand' | 'primary';

const STATUS_VARIANTS: Record<string, StatusVariant> = {
    ready: 'success',
    completed: 'success',
    success: 'success',
    active: 'success',
    published: 'success',
    healthy: 'success',
    online: 'success',
    accepted: 'success',
    connected: 'success',

    processing: 'warning',
    queued: 'warning',
    rendering: 'warning',
    warning: 'warning',
    pending: 'warning',
    'waiting-for-process': 'warning',
    analyzing: 'warning',

    running: 'active',

    failed: 'danger',
    error: 'danger',
    danger: 'danger',
    critical: 'danger',
    rejected: 'danger',

    inactive: 'inactive',
    draft: 'inactive',
    disabled: 'inactive',
    offline: 'inactive',
    disconnected: 'inactive',

    brand: 'brand',
    primary: 'primary'
};

/**
 * The variant → colour step collapses under the monochrome accent: `active`,
 * `brand` and `primary` all mean "the foreground", and both grey variants mean
 * "muted". Only the three status hues survive as hues.
 */
const VARIANT_CLASS: Record<StatusVariant, string> = {
    active: 'text-foreground',
    brand: 'text-foreground',
    primary: 'text-foreground',
    success: 'text-success',
    warning: 'text-warning',
    danger: 'text-danger',
    inactive: 'text-muted',
    neutral: 'text-muted'
};

/** Shared shape of a status badge. bravais's `StatusBadge` had no background and
 *  no border in any variant — it was coloured, uppercased text and nothing else,
 *  which is why a HeroUI `Chip` is the wrong replacement: it would add a pill fill
 *  that was never there. */
export const STATUS_BADGE_CLASS = 'inline-flex items-center gap-1 rounded-full text-xs font-medium uppercase whitespace-nowrap';

export const resolveStatusVariant = (status: string): StatusVariant =>
    STATUS_VARIANTS[status.toLowerCase()] ?? 'neutral';

/** The complete class string for a status badge, tone included. */
export const statusBadgeClass = (status: string): string =>
    `${STATUS_BADGE_CLASS} ${VARIANT_CLASS[resolveStatusVariant(status)]}`;
