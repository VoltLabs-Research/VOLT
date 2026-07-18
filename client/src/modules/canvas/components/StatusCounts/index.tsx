import { Clock, Play, Check, X } from 'lucide-react';
import { Row, StatusBadge } from '@voltstack/bravais';

import type { ComponentType } from 'react';

interface StatusCountsProps {
    queued: number;
    running: number;
    completed: number;
    failed?: number;
    
    hideZero?: boolean;
}

type StatusCountKey = 'queued' | 'running' | 'completed' | 'failed';

const ICON_STYLE = { width: 10, height: 10 };

const BADGES: { key: string; variant: 'warning' | 'active' | 'success' | 'danger'; Icon: ComponentType<{ style: React.CSSProperties }>; countKey: StatusCountKey }[] = [
    { key: 'queued', variant: 'warning', Icon: Clock, countKey: 'queued' },
    { key: 'running', variant: 'active', Icon: Play, countKey: 'running' },
    { key: 'completed', variant: 'success', Icon: Check, countKey: 'completed' },
    { key: 'failed', variant: 'danger', Icon: X, countKey: 'failed' }
];

const StatusCounts = ({ hideZero = false, ...counts }: StatusCountsProps) => (
    <Row gap='05'>
        {BADGES.map(({ key, variant, Icon, countKey }) => {
            const count = counts[countKey] ?? 0;
            if (hideZero && count === 0) {
                return null;
            }

            return (
                <StatusBadge key={key} variant={variant} size="compact" className="d-flex items-center">
                    <Icon style={ICON_STYLE} />
                    <span>{count}</span>
                </StatusBadge>
            );
        })}
    </Row>
);

export default StatusCounts;
