import useAnalysisActivitySummary from '../../hooks/use-analysis-activity-summary';
import { useAnalysesByTrajectoryQuery } from '@/modules/analysis/hooks/queries';
import { findCachedAnalysisById } from '@/modules/analysis/services/cache';
import { normalizeCanvasAnalysisStatus } from '../../utilities/analysis-status';
import { formatSize } from '@/shared/utils/format';
import Box from '@/shared/presentation/primitives/Box';
import Row from '@/shared/presentation/primitives/Row';
import { useMemo } from 'react';
import type { Analysis, AnalysisStage } from '@/modules/analysis/api/entities/analysis';
import type { Trajectory } from '@/modules/trajectory/api/entities/trajectory/trajectory';
import type { ReactNode } from 'react';

import './StatusBar.css';

interface StatusItem {
    key: string;
    label: string;
    value: ReactNode;
    title?: string;
    className?: string;
}

interface StatusBarProps {
    trajectory: Trajectory | null | undefined;
    currentTimestep: number | undefined;
    analysisId?: string;
}

interface AnalysisStatusValue {
    label: string;
    tone?: 'running' | 'queued' | 'ready' | 'failed';
    title?: string;
}

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

const getLatestRunningStage = (analysis: Analysis | undefined): AnalysisStage | undefined => {
    const analysisStatus = normalizeCanvasAnalysisStatus(analysis?.status);
    return [...(analysis?.stages ?? [])].reverse().find((stage) => {
        if (stage.status !== 'running') {
            return false;
        }

        return analysisStatus !== 'completed' || stage.type === 'artifact-upload';
    });
};

const resolveSelectedAnalysisStatusValue = (
    analysis: Analysis | undefined
): AnalysisStatusValue | null => {
    if (!analysis) {
        return null;
    }

    const runningStage = getLatestRunningStage(analysis);
    if (runningStage) {
        return {
            label: runningStage.label,
            tone: 'running',
            title: `${analysis.pluginDisplayName}: ${runningStage.label}`
        };
    }

    if (analysis.artifactStatus === 'generating') {
        return { label: 'Generating artifacts', tone: 'running', title: analysis.pluginDisplayName };
    }
    if (analysis.artifactStatus === 'uploading') {
        return { label: 'Uploading artifacts', tone: 'running', title: analysis.pluginDisplayName };
    }
    if (analysis.artifactStatus === 'ready') {
        return { label: 'Artifacts ready', tone: 'ready', title: analysis.pluginDisplayName };
    }
    if (analysis.artifactStatus === 'failed') {
        return { label: 'Artifacts failed', tone: 'failed', title: analysis.pluginDisplayName };
    }

    const status = normalizeCanvasAnalysisStatus(analysis.status);
    if (status === 'running') {
        return { label: 'Running', tone: 'running', title: analysis.pluginDisplayName };
    }
    if (status === 'pending') {
        return { label: 'Queued', tone: 'queued', title: analysis.pluginDisplayName };
    }
    if (status === 'completed') {
        return { label: 'Completed', tone: 'ready', title: analysis.pluginDisplayName };
    }
    if (status === 'failed') {
        return { label: 'Failed', tone: 'failed', title: analysis.pluginDisplayName };
    }

    return null;
};

const renderAnalysisStatusValue = (value: AnalysisStatusValue) => (
    <span
        className={`canvas-status-activity ${value.tone ? `canvas-status-activity--${value.tone}` : ''}`.trim()}
        title={value.title}
    >
        {value.label}
    </span>
);

const StatusBar = ({ trajectory, currentTimestep, analysisId }: StatusBarProps) => {
    const activitySummary = useAnalysisActivitySummary(trajectory ?? undefined);
    const trajectoryId = trajectory?._id;
    const analysesQuery = useAnalysesByTrajectoryQuery(
        { trajectoryId: trajectoryId ?? '', page: 1, limit: 100 },
        { enabled: !!trajectoryId && !!analysisId }
    );
    const selectedAnalysis = useMemo(() => {
        if (!analysisId) {
            return undefined;
        }

        return findCachedAnalysisById({
            analysisId,
            trajectoryId,
            fallbackAnalyses: [
                ...((analysesQuery.data as { data?: Analysis[] } | undefined)?.data ?? []),
                ...(trajectory?.analysis ?? [])
            ]
        });
    }, [analysisId, analysesQuery.data, trajectory?.analysis, trajectoryId]);
    const selectedAnalysisStatusValue = resolveSelectedAnalysisStatusValue(selectedAnalysis);

    let teamName = '-';
    if (trajectory && typeof trajectory.team === 'object' && trajectory.team) {
        teamName = trajectory.team.name;
    }

    const activityItem: StatusItem = selectedAnalysisStatusValue
        ? {
            key: 'analysis-activity',
            label: 'Analysis',
            title: selectedAnalysisStatusValue.title,
            value: renderAnalysisStatusValue(selectedAnalysisStatusValue)
        }
        : activitySummary.runningCount > 0
        ? {
            key: 'analysis-activity',
            label: 'Analysis',
            title: [
                activitySummary.runningTitle ? `Running: ${activitySummary.runningTitle}` : '',
                activitySummary.queuedTitle ? `Queued: ${activitySummary.queuedTitle}` : ''
            ].filter(Boolean).join(' • '),
            value: (
                <>
                    <span className="color-muted">Running: </span>
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
                label: 'Analysis',
                title: activitySummary.queuedTitle,
                value: (
                    <>
                        <span className="color-muted">Queued: </span>
                        <span className="canvas-status-activity canvas-status-activity--queued">{activitySummary.queuedLabel}</span>
                    </>
                )
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
