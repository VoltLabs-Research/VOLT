import useAnalysisActivitySummary from '../../../hooks/use-analysis-activity-summary';
import { formatSize } from '@/shared/utils/format';
import Container from '@/shared/presentation/components/Container';

import type { Trajectory } from '@/modules/trajectory/api/entities/trajectory';
import type { ReactNode } from 'react';

import './StatusBar.css';

interface StatusItem {
    key: string;
    label: string;
    value: ReactNode;
    title?: string;
    className?: string;
};

interface StatusBarProps {
    trajectory: Trajectory | null | undefined;
    currentTimestep: number | undefined;
};

const StatusGroup = ({ items }: { items: StatusItem[] }) => (
    <Container className="canvas-status-group d-flex items-center gap-05">
        {items.map(({ key, label, value, title, className }, i) => (
            <Container key={key} className="canvas-status-item d-flex items-center gap-05">
                {i > 0 && <Container className="canvas-status-divider" />}
                <span className={`canvas-status-item-text font-size-1 color-muted ${className ?? ''}`.trim()} title={title}>
                    {label}{label && ': '}{value}
                </span>
            </Container>
        ))}
    </Container>
);

const StatusBar = ({ trajectory, currentTimestep }: StatusBarProps) => {
    const activitySummary = useAnalysisActivitySummary(trajectory ?? undefined);

    let teamName = '-';
    if (trajectory && typeof trajectory.team === 'object' && trajectory.team) {
        teamName = trajectory.team.name;
    }

    const activityItem: StatusItem = activitySummary.runningCount > 0
        ? {
            key: 'analysis-activity',
            label: activitySummary.runningCount === 1 ? 'Running Analysis' : 'Running Analyses',
            title: [
                activitySummary.runningTitle ? `Running: ${activitySummary.runningTitle}` : '',
                activitySummary.queuedTitle ? `Queued: ${activitySummary.queuedTitle}` : ''
            ].filter(Boolean).join(' • '),
            value: (
                <>
                    <span className="canvas-status-activity canvas-status-activity--running">
                        {activitySummary.runningLabel}
                    </span>
                    {activitySummary.queuedCount > 0 && (
                        <span className="canvas-status-activity-queued">
                            {' '}(
                            <span className="color-muted">Queued: </span>
                            <span className="canvas-status-activity canvas-status-activity--queued">{activitySummary.queuedLabel}</span>
                            )
                        </span>
                    )}
                </>
            )
        }
        : activitySummary.queuedCount > 0
            ? {
                key: 'analysis-activity',
                label: activitySummary.queuedCount === 1 ? 'Queued Analysis' : 'Queued Analyses',
                title: activitySummary.queuedTitle,
                value: <span className="canvas-status-activity canvas-status-activity--queued">{activitySummary.queuedLabel}</span>
            }
            : {
                key: 'analysis-activity',
                label: 'Analysis',
                value: <span className="color-secondary">Idle</span>
            };

    const atoms = trajectory?.frames?.[0]?.natoms ?? 0;
    const frames = trajectory?.frames?.length ?? 0;
    const size = trajectory?.stats?.totalSize !== undefined ? formatSize(trajectory.stats.totalSize) : '—';

    const left: StatusItem[] = [
        { key: 'atoms', label: 'Atoms', value: atoms },
        { key: 'frames', label: 'Frames', value: frames },
        { key: 'size', label: 'Size', value: size },
        activityItem
    ];

    const right: StatusItem[] = [
        { key: 'timestep', label: 'Timestep', value: currentTimestep ?? '—' },
        { key: 'team', label: '', value: teamName }
    ];

    return (
        <Container className="canvas-status-bar d-flex items-center content-between">
            <Container className="canvas-status-main d-flex items-center gap-05">
                <Container className="canvas-live-dot radius-full f-shrink-0" />
                <StatusGroup items={left} />
            </Container>
            <StatusGroup items={right} />
        </Container>
    );
};

export default StatusBar;
