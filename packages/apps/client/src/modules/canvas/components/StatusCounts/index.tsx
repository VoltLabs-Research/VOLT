import { Clock, Play, Check, X } from 'lucide-react';
import { cn } from '@heroui/react';

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

const BADGES: { key: string; Icon: ComponentType<{ style: React.CSSProperties }>; countKey: StatusCountKey }[] = [
    {
        key: 'queued',
        Icon: Clock,
        countKey: 'queued'
    },
    {
        key: 'running',
        Icon: Play,
        countKey: 'running'
    },
    {
        key: 'completed',
        Icon: Check,
        countKey: 'completed'
    },
    {
        key: 'failed',
        Icon: X,
        countKey: 'failed'
    }
];

const StatusCounts = ({ hideZero = false, ...counts }: StatusCountsProps) => {
    const toneClass = {
        queued: 'text-warning',
        running: 'text-info',
        completed: 'text-success',
        failed: 'text-danger'
    } as const;

    return (
        <div className='flex flex-row items-center gap-2'>
            {BADGES.map(({ key, Icon, countKey }) => {
                const count = counts[countKey] ?? 0;
                if (hideZero && count === 0) {
                    return null;
                }

                return (
                    <span key={key} className={cn('inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium uppercase', toneClass[countKey])}>
                        <Icon style={ICON_STYLE} />
                        <span>{count}</span>
                    </span>
                );
            })}
        </div>
    );
};

export default StatusCounts;
