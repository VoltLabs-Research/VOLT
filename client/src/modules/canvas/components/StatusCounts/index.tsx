import { Clock, Play, Check, X } from 'lucide-react';

import type { ComponentType } from 'react';

interface StatusCountsProps {
    queued: number;
    running: number;
    completed: number;
    failed?: number;

    hideZero?: boolean;
}

type StatusCountKey = 'queued' | 'running' | 'completed' | 'failed';

const ICON_STYLE = {
    width: 10,
    height: 10
};

/**
 * bravais's `StatusBadge size='compact'` was not a badge at all: `size-compact` set
 * `padding: 0; border: none; border-radius: 0`, leaving coloured uppercase text. So
 * this is a span, not a HeroUI `Chip` — a Chip would introduce the fill and pill the
 * compact size deliberately removed.
 *
 * `variant='active'` painted `--accent-blue`, which VOLT had already collapsed onto
 * the foreground, so it maps to `text-foreground` (spec §3a) rather than to a hue.
 */
const BADGE_CLASS = 'inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium uppercase';

const BADGES: { key: string; toneClass: string; Icon: ComponentType<{ style: React.CSSProperties }>; countKey: StatusCountKey }[] = [
    {
        key: 'queued',
        toneClass: 'text-warning',
        Icon: Clock,
        countKey: 'queued'
    },
    {
        key: 'running',
        toneClass: 'text-foreground',
        Icon: Play,
        countKey: 'running'
    },
    {
        key: 'completed',
        toneClass: 'text-success',
        Icon: Check,
        countKey: 'completed'
    },
    {
        key: 'failed',
        toneClass: 'text-danger',
        Icon: X,
        countKey: 'failed'
    }
];

const StatusCounts = ({ hideZero = false, ...counts }: StatusCountsProps) => (
    <div className='flex flex-row items-center gap-2'>
        {BADGES.map(({ key, toneClass, Icon, countKey }) => {
            const count = counts[countKey] ?? 0;
            if (hideZero && count === 0) {
                return null;
            }

            return (
                <span key={key} className={`${BADGE_CLASS} ${toneClass}`}>
                    <Icon style={ICON_STYLE} />
                    <span>{count}</span>
                </span>
            );
        })}
    </div>
);

export default StatusCounts;
