/**
 * bravais's `StatusBadge`, reduced to what it actually painted.
 *
 * It is deliberately NOT a HeroUI `Chip`. Despite carrying `rounded-full`,
 * `StatusBadge` had no background and no border in any variant — it was coloured,
 * uppercased text and nothing else (`.status-badge { display: inline-flex;
 * align-items: center; white-space: nowrap; text-transform: uppercase }`). A Chip
 * would add a pill fill that was never there.
 *
 * `text-transform: uppercase` is the quiet one: it lived only in CSS, so the DOM
 * text is the caller's original casing. Call sites pass `status='running'` and
 * read `RUNNING`; dropping `uppercase` would silently lowercase every badge.
 *
 * The status→variant table is bravais's, verbatim, because it is not
 * self-evident: `status='active'` resolves to the SUCCESS variant (green) while
 * `variant='active'` was blue, and `status='running'` resolves to `active`. The
 * variant→colour step then collapses under §3a of the migration spec — the accent
 * IS the foreground here, so `active`, `brand` and `primary` all land on
 * `text-foreground`, and the two grey variants land on `text-muted`.
 */
const BADGE_CLASS_NAMES = 'inline-flex items-center gap-1 rounded-full text-xs font-medium uppercase whitespace-nowrap';

type StatusBadgeVariant = 'active' | 'inactive' | 'danger' | 'neutral' | 'success' | 'warning' | 'brand' | 'primary';

const STATUS_VARIANTS: Record<string, StatusBadgeVariant> = {
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

const VARIANT_CLASS_NAMES: Record<StatusBadgeVariant, string> = {
    active: 'text-foreground',
    brand: 'text-foreground',
    primary: 'text-foreground',
    success: 'text-success',
    warning: 'text-warning',
    danger: 'text-danger',
    inactive: 'text-muted',
    neutral: 'text-muted'
};

interface ContainerStatusBadgeProps {
    status: string;
};

const ContainerStatusBadge = ({ status }: ContainerStatusBadgeProps) => {
    const variant = STATUS_VARIANTS[status.toLowerCase()] ?? 'neutral';

    return (
        <span className={`${BADGE_CLASS_NAMES} ${VARIANT_CLASS_NAMES[variant]}`}>
            {status}
        </span>
    );
};

export default ContainerStatusBadge;
