import { cn } from '@heroui/react';
import type { ReactNode } from 'react';

/**
 * What bravais's `StatusBadge size='compact'` actually painted — and nothing more.
 *
 * `.status-badge.size-compact` set `padding: 0; border: none !important;
 * border-radius: 0`, so the badge was never a pill. It was uppercase, coloured
 * text: `display: inline-flex; align-items: center; white-space: nowrap;
 * text-transform: uppercase` plus `gap-1 text-sm font-medium` from the class list.
 * HeroUI's `Chip` is therefore the wrong replacement — it paints a filled, padded
 * surface where there was none. A span is the faithful one.
 *
 * `text-sm` was 0.75rem under bravais's `--text-*`, which is stock Tailwind's
 * `text-xs` (spec §3c).
 *
 * The tone names are bravais's `StatusBadgeVariant` values, kept verbatim so
 * `getTeamClusterStatusVariant`, `getTeamClusterRoleBadgeVariant` and
 * `getClusterTransferJobStateBadgeVariant` keep returning what they returned. Two
 * groups collapse, because the tokens behind them collapsed:
 *
 *   • `inactive` and `neutral` were both `--color-text-secondary` → `text-muted`
 *   • `active`, `brand` (`--accent-blue`) and `primary` (`--color-text-primary`)
 *     all resolve to the foreground, because under VOLT the accent *is* the
 *     foreground (spec §3a)
 *
 * The uppercasing is the one thing a token-only swap silently loses: callers pass
 * `Waiting for connection` and have always seen `WAITING FOR CONNECTION`.
 */
export type ClusterBadgeTone =
    | 'success'
    | 'warning'
    | 'danger'
    | 'neutral'
    | 'inactive'
    | 'active'
    | 'brand'
    | 'primary';

const BADGE_CLASS = 'inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium uppercase';

const TONE_CLASS: Record<ClusterBadgeTone, string> = {
    success: 'text-success',
    warning: 'text-warning',
    danger: 'text-danger',
    neutral: 'text-muted',
    inactive: 'text-muted',
    active: 'text-foreground',
    brand: 'text-foreground',
    primary: 'text-foreground'
};

interface ClusterStatusBadgeProps {
    tone: ClusterBadgeTone;
    children: ReactNode;
};

const ClusterStatusBadge = ({ tone, children }: ClusterStatusBadgeProps) => (
    <span className={cn(BADGE_CLASS, TONE_CLASS[tone])}>
        {children}
    </span>
);

export default ClusterStatusBadge;
