import type { ComponentType } from 'react';
import { Clock, Play, Check } from 'lucide-react';
import Container from '@/shared/presentation/components/Container';
import StatusBadge from '@/shared/presentation/components/StatusBadge';

interface StatusCountsProps {
    queued: number;
    running: number;
    completed: number;
}

const ICON_STYLE = { width: 10, height: 10 };

const BADGES: { key: string; variant: 'warning' | 'active' | 'success'; Icon: ComponentType<{ style: React.CSSProperties }>; countKey: keyof StatusCountsProps }[] = [
    { key: 'queued', variant: 'warning', Icon: Clock, countKey: 'queued' },
    { key: 'running', variant: 'active', Icon: Play, countKey: 'running' },
    { key: 'completed', variant: 'success', Icon: Check, countKey: 'completed' }
];

const StatusCounts = (props: StatusCountsProps) => (
    <Container className="d-flex items-center gap-05">
        {BADGES.map(({ key, variant, Icon, countKey }) => (
            <StatusBadge key={key} variant={variant} size="compact" className="d-flex items-center">
                <Icon style={ICON_STYLE} />
                <span>{props[countKey]}</span>
            </StatusBadge>
        ))}
    </Container>
);

export default StatusCounts;
