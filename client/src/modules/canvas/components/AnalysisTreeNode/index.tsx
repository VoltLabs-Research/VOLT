import { ChevronDown, ChevronRight, Download, MousePointerClick, Trash2 } from 'lucide-react';
import {
    AnalysisTreeRetryRow,
    CanvasTreeEmptyRow,
    CanvasTreeSkeletonRows,
    MaybeContextMenu,
    TREE_ROW_CLASS,
    nextTreeIndent,
    treeIndentClass
} from '../CanvasTree';
import { Tooltip, cn } from '@heroui/react';
import { CanvasAnalysisStatusEnum, isCanvasAnalysisInProgress, isCanvasAnalysisSettled, normalizeCanvasAnalysisStatus } from '../../utils/analysis-status';
import { resolveAnalysisPluginId } from '@/modules/analysis/utils/resolve-plugin-id';
import { buildArtifactRows } from './artifact-rows';
import { hasPluginWorkflowNodes } from './config-columns';
import ExecutionConfigSummary from './ExecutionConfigSummary';
import ExposureRow from './ExposureRow';
import PendingArtifactRow from './PendingArtifactRow';
import useRecentlyReadyArtifacts from './use-recently-ready-artifacts';

import type { ReactNode } from 'react';
import type { AnalysisActivityTone } from '../../hooks/use-analysis-activity-tone';
import type { AnalysisSectionData } from '../../utils/sidebar-scene-sections';
import type { CanvasAnalysisStatus } from '../../utils/analysis-status';
import type { CanvasTreeIndent } from '../CanvasTree';
import type { MenuOption } from '@/shared/contracts/menu';
import type { Plugin } from '@volt/contracts/modules/plugin/plugin';
import type { SceneObjectType } from '@/modules/fractal/contracts/scene';
import type { SceneRowActions } from './ExposureRow';
import Scrollable from '@/shared/ui/components/Scrollable';

interface AnalysisTreeNodeProps extends SceneRowActions {
    section: AnalysisSectionData;
    status?: CanvasAnalysisStatus;
    tone?: AnalysisActivityTone;
    isExpanded: boolean;
    onToggle: (id: string) => void;
    onDeleteAnalysis: (analysisId: string) => Promise<void>;
    onDownloadAnalysis: (analysisId: string) => void | Promise<void>;
    onRetryLoadExposures?: (analysisId: string) => void;
    plugin?: Plugin;
    pluginsById?: Record<string, Plugin>;
    tourTargetId?: string;
    firstExposureTourTargetId?: string;
    /** Depth of the analysis row itself; its exposures render one level deeper. */
    indent?: CanvasTreeIndent;
    /** Rendered between the chevron and the name — used to mark a cached stage. */
    badge?: ReactNode;
}

const TRAJECTORY_SCENE: SceneObjectType = {
    sceneType: 'trajectory',
    source: 'default'
};

const CHEVRON_STYLE = {
    width: 13,
    height: 13
};

const AnalysisTreeNode = ({
    section,
    status,
    tone,
    isExpanded,
    onToggle,
    onDeleteAnalysis,
    onDownloadAnalysis,
    onRetryLoadExposures,
    plugin,
    pluginsById,
    tourTargetId,
    firstExposureTourTargetId,
    indent = 'base',
    badge,
    ...sceneActions
}: AnalysisTreeNodeProps) => {
    const childIndent = nextTreeIndent(indent);
    const { analysis, entry, isCurrentAnalysis } = section;
    const { onSelectScene } = sceneActions;
    const resolvedStatus = status ?? normalizeCanvasAnalysisStatus(analysis.status);
    const isAnalysisInProgress = isCanvasAnalysisInProgress(resolvedStatus);
    const artifactRows = buildArtifactRows(
        analysis.expectedArtifacts,
        entry.exposures,
        isCanvasAnalysisSettled(resolvedStatus)
    );
    const firstExposureRowKey = artifactRows.find((row) => row.exposure)?.key;
    const recentlyReadyArtifactIds = useRecentlyReadyArtifacts(analysis.expectedArtifacts);
    const isSelectedAnalysis = isCurrentAnalysis;

    const hasConfig = Object.keys(analysis.config).length > 0;
    const hasWorkflowPluginNodes = hasPluginWorkflowNodes(plugin);

    const tooltipContent = isAnalysisInProgress || hasConfig || hasWorkflowPluginNodes ? (
        <div className='flex flex-col'>
            {isAnalysisInProgress && (
                <div className='border-b border-border px-3 py-2 text-xs text-warning'>
                    Analysis still running. Some options will be disabled until it finishes.
                </div>
            )}
            <Scrollable className='max-h-[min(22rem,calc(100dvh-6rem))] overscroll-contain'>
                {hasConfig || hasWorkflowPluginNodes ? (
                    <ExecutionConfigSummary
                        config={analysis.config}
                        plugin={plugin}
                        pluginsById={pluginsById}
                    />
                ) : (
                    <div className='p-3 text-xs text-muted'>No execution config captured for this analysis.</div>
                )}
            </Scrollable>
        </div>
    ) : null;

    const handleSelectAnalysis = () => {
        if (isAnalysisInProgress) {
            onToggle(analysis._id);
            return;
        }

        if (isSelectedAnalysis) {
            onSelectScene(TRAJECTORY_SCENE);
            return;
        }

        onToggle(analysis._id);
        onSelectScene(TRAJECTORY_SCENE, analysis);
    };

    const analysisMenuOptions: MenuOption[] = [
        {
            label: isSelectedAnalysis ? 'Deselect' : 'Select',
            icon: MousePointerClick,
            onClick: handleSelectAnalysis,
            disabled: isAnalysisInProgress
        },
        {
            label: 'Download',
            icon: Download,
            onClick: () => onDownloadAnalysis(analysis._id),
            disabled: resolvedStatus !== CanvasAnalysisStatusEnum.Completed
        },
        {
            label: 'Delete',
            icon: Trash2,
            onClick: () => onDeleteAnalysis(analysis._id),
            destructive: true
        }
    ];

    const nameToneClass = {
        queued: 'text-warning-soft-foreground',
        running: 'text-info-soft-foreground',
        completed: 'text-success-soft-foreground',
        failed: 'text-danger-soft-foreground'
    } as const;

    const nameClassName = cn(
        'min-w-0 flex-[0_1_auto] transition-[color,text-shadow] duration-[180ms]',
        'truncate',
        isSelectedAnalysis ? 'text-foreground' : 'text-muted',
        tone && nameToneClass[tone]
    );

    return (
        <>
            <MaybeContextMenu
                enabled
                id={`canvas-ctx-analysis-${analysis._id}`}
                options={analysisMenuOptions}
            >
                <Tooltip isDisabled={!tooltipContent}>
                    <Tooltip.Trigger
                        className={cn(
                            'flex cursor-pointer select-none items-center gap-2 text-xs text-muted',
                            TREE_ROW_CLASS,
                            'hover:rounded-md hover:bg-surface-hover',
                            treeIndentClass(indent),
                            isSelectedAnalysis && 'text-accent'
                        )}
                        onClick={handleSelectAnalysis}
                        role='treeitem'
                        aria-selected={isSelectedAnalysis}
                        tabIndex={0}
                        data-tour-id={tourTargetId}
                    >
                        <span className='flex min-w-0 flex-[0_1_auto] items-center gap-1.5'>
                            <span className={nameClassName} title={analysis.pluginDisplayName}>
                                {analysis.pluginDisplayName}
                            </span>
                            {badge}
                        </span>
                        <span className='flex-1' />
                        <button
                            type='button'
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggle(analysis._id);
                            }}
                            className={cn('flex cursor-pointer items-center justify-center', 'size-auto min-h-0 min-w-0 border-0 bg-transparent p-0 text-muted')}
                            aria-label={isExpanded ? 'Collapse' : 'Expand'}
                        >
                            {isExpanded
                                ? <ChevronDown style={CHEVRON_STYLE} />
                                : <ChevronRight style={CHEVRON_STYLE} />
                            }
                        </button>
                    </Tooltip.Trigger>
                    {tooltipContent && (
                        <Tooltip.Content placement='right' className='pointer-events-auto w-[min(32rem,calc(100vw-2rem))] max-w-[32rem] whitespace-normal border border-border bg-surface p-0'>
                            {tooltipContent}
                        </Tooltip.Content>
                    )}
                </Tooltip>
            </MaybeContextMenu>

            {isExpanded && entry.state === 'loading' && !analysis.expectedArtifacts?.length && (
                <CanvasTreeSkeletonRows count={1} compact indent={childIndent} />
            )}

            {isExpanded && entry.state === 'error' && onRetryLoadExposures && (
                <AnalysisTreeRetryRow onRetry={() => onRetryLoadExposures(analysis._id)} indent={childIndent} />
            )}

            {isExpanded && artifactRows.map(({ key, artifact, exposure }) => {
                const isRecentlyReady = artifact ? recentlyReadyArtifactIds.has(artifact.exposureId) : false;

                if (!exposure) {
                    return (
                        <PendingArtifactRow
                            key={key}
                            artifact={artifact}
                            fallbackName={key}
                            isRecentlyReady={isRecentlyReady}
                            indent={childIndent}
                        />
                    );
                }

                return (
                    <ExposureRow
                        key={key}
                        {...sceneActions}
                        analysis={analysis}
                        artifact={artifact}
                        exposure={exposure}
                        pluginId={resolveAnalysisPluginId(analysis)}
                        isRecentlyReady={isRecentlyReady}
                        tourTargetId={key === firstExposureRowKey ? firstExposureTourTargetId : undefined}
                        indent={childIndent}
                    />
                );
            })}

            {isExpanded && entry.state === 'loaded' && artifactRows.length === 0 && (
                <CanvasTreeEmptyRow label='No models' indent={childIndent} />
            )}
        </>
    );
};

export default AnalysisTreeNode;
