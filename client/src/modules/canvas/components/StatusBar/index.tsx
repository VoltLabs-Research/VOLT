import useAnalysisActivitySummary from '../../hooks/use-analysis-activity-summary';
import { formatSize } from '@/shared/utils/format';
import Box from '@/shared/presentation/primitives/Box';
import Row from '@/shared/presentation/primitives/Row';
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
    <Row gap='05' className="canvas-status-group">
        {items.map(({ key, label, value, title, className }, i) => (
            <Row key={key} gap='05' className="canvas-status-item">
                {i > 0 && <div className="canvas-status-divider" />}
                <span className={`canvas-status-item-text font-size-1 color-muted ${className ?? ''}`.trim()} title={title}>
                    {label}{label && ': '}{value}
                </span>
            </Row>
        ))}
    </Row>
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
        <Row justify='between' className="canvas-status-bar">
            <Row gap='05' className="canvas-status-main">
                <Box radius='full' shrink='0' className="canvas-live-dot" />
                <StatusGroup items={left} />
            </Row>
            <StatusGroup items={right} />
        </Row>
    );
};

export default StatusBar;
