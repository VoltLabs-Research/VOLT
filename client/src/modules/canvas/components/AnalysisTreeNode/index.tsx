import { ChevronDown, ChevronRight, Download, MousePointerClick, Trash2 } from 'lucide-react';
import {
    AnalysisTreeRetryRow,
    CanvasTreeEmptyRow,
    CanvasTreeSkeletonRows,
    MaybeContextMenu
} from '../CanvasTree';
import { Tooltip, cn } from '@heroui/react';
import {
    CONFIG_TOOLTIP_BODY_CLASS,
    CONFIG_TOOLTIP_CLASS,
    CONFIG_TOOLTIP_EMPTY_CLASS,
    CONFIG_TOOLTIP_WARNING_CLASS,
    TREE_ANALYSIS_CONFIG_HINT_CLASS,
    TREE_ANALYSIS_LABEL_GROUP_CLASS,
    TREE_ANALYSIS_NAME_CLASS,
    TREE_ANALYSIS_NAME_TONE_CLASS,
    TREE_ITEM_CLASS,
    TREE_ITEM_HOVER_CLASS,
    TREE_ITEM_INDENT_CLASS,
    TREE_ITEM_SELECTED_CLASS,
    TREE_TOGGLE_CLASS
} from '../ObjectsPanel/tree-classes';
import { CanvasAnalysisStatusEnum, isCanvasAnalysisInProgress, normalizeCanvasAnalysisStatus } from '../../utils/analysis-status';
import { resolveAnalysisPluginId } from '@/modules/analysis/utils/resolve-plugin-id';
import { buildArtifactRows } from './artifact-rows';
import { hasPluginWorkflowNodes } from './config-columns';
import { toInlineConfigSummary } from './config-values';
import ExecutionConfigSummary from './ExecutionConfigSummary';
import ExposureRow from './ExposureRow';
import PendingArtifactRow from './PendingArtifactRow';
import useRecentlyReadyArtifacts from './use-recently-ready-artifacts';

import type { AnalysisActivityTone } from '../../hooks/use-analysis-activity-tone';
import type { AnalysisSectionData } from '../../hooks/use-canvas-sidebar-scene';
import type { CanvasAnalysisStatus } from '../../utils/analysis-status';
import type { MenuOption } from '@/shared/contracts/menu';
import type { Plugin } from '@volt/contracts/modules/plugin/plugin';
import type { SceneObjectType } from '@/modules/fractal/contracts/scene';
import type { SceneRowActions } from './ExposureRow';

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
    selectionMode?: 'default' | 'raster';
    tourTargetId?: string;
    firstExposureTourTargetId?: string;
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
    selectionMode = 'default',
    tourTargetId,
    firstExposureTourTargetId,
    ...sceneActions
}: AnalysisTreeNodeProps) => {
    const { analysis, entry, isCurrentAnalysis } = section;
    const { onSelectScene, selectedScene } = sceneActions;
    const isRasterSelectionMode = selectionMode === 'raster';
    const artifactRows = buildArtifactRows(analysis.expectedArtifacts, entry.exposures);
    const firstExposureRowKey = artifactRows.find((row) => row.exposure)?.key;
    const recentlyReadyArtifactIds = useRecentlyReadyArtifacts(analysis.expectedArtifacts);
    const resolvedStatus = status ?? normalizeCanvasAnalysisStatus(analysis.status);
    const isAnalysisInProgress = isCanvasAnalysisInProgress(resolvedStatus);
    const isSelectedAnalysis = isRasterSelectionMode
        ? selectedScene?.source === 'plugin' && selectedScene.analysisId === analysis._id
        : isCurrentAnalysis;

    const hasConfig = Object.keys(analysis.config).length > 0;
    const hasWorkflowPluginNodes = hasPluginWorkflowNodes(plugin);
    const inlineSummary = toInlineConfigSummary(analysis.config);

    const tooltipContent = isAnalysisInProgress || hasConfig || hasWorkflowPluginNodes ? (
        <div className='flex flex-col'>
            {isAnalysisInProgress && (
                <div className={CONFIG_TOOLTIP_WARNING_CLASS}>
                    Analysis still running. Some options will be disabled until it finishes.
                </div>
            )}
            <div className={CONFIG_TOOLTIP_BODY_CLASS}>
                {hasConfig || hasWorkflowPluginNodes ? (
                    <ExecutionConfigSummary
                        config={analysis.config}
                        plugin={plugin}
                        pluginsById={pluginsById}
                    />
                ) : (
                    <div className={CONFIG_TOOLTIP_EMPTY_CLASS}>No execution config captured for this analysis.</div>
                )}
            </div>
        </div>
    ) : null;

    const handleSelectAnalysis = () => {
        if (isRasterSelectionMode || isAnalysisInProgress) {
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

    const nameClassName = cn(
        TREE_ANALYSIS_NAME_CLASS,
        'truncate',
        isSelectedAnalysis ? 'text-foreground' : 'text-muted',
        tone && TREE_ANALYSIS_NAME_TONE_CLASS[tone]
    );

    return (
        <>
            <MaybeContextMenu
                enabled={!isRasterSelectionMode}
                id={`canvas-ctx-analysis-${analysis._id}`}
                options={analysisMenuOptions}
            >
                {/*
                  * `Tooltip.Trigger` IS the tree row rather than a wrapper around it: HeroUI
                  * hard-codes `role='button'` on that part but spreads the caller's props
                  * after it, so `role='treeitem'` wins and the `role='tree'` container keeps
                  * a valid child. Wrapping instead would insert a `role='button'` element
                  * between the two.
                  */}
                <Tooltip isDisabled={!tooltipContent}>
                    <Tooltip.Trigger
                        className={cn(
                            'flex cursor-pointer select-none items-center gap-2 text-xs text-muted',
                            TREE_ITEM_CLASS,
                            TREE_ITEM_HOVER_CLASS,
                            TREE_ITEM_INDENT_CLASS.base,
                            isSelectedAnalysis && TREE_ITEM_SELECTED_CLASS
                        )}
                        onClick={handleSelectAnalysis}
                        role='treeitem'
                        aria-selected={isSelectedAnalysis}
                        tabIndex={0}
                        data-tour-id={tourTargetId}
                    >
                        <span className={TREE_ANALYSIS_LABEL_GROUP_CLASS}>
                            <span className={nameClassName} title={analysis.pluginDisplayName}>
                                {analysis.pluginDisplayName}
                            </span>
                            {inlineSummary && (
                                <span className={TREE_ANALYSIS_CONFIG_HINT_CLASS} title={inlineSummary}>
                                    {inlineSummary}
                                </span>
                            )}
                        </span>
                        <span className='flex-1' />
                        {/*
                          * A plain button: the handler's `stopPropagation()` is what stops the
                          * chevron from also selecting the analysis, and `onPress` receives a
                          * React Aria PressEvent with no such method (spec §4b).
                          */}
                        <button
                            type='button'
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggle(analysis._id);
                            }}
                            className={cn('flex cursor-pointer items-center justify-center', TREE_TOGGLE_CLASS)}
                            aria-label={isExpanded ? 'Collapse' : 'Expand'}
                        >
                            {isExpanded
                                ? <ChevronDown style={CHEVRON_STYLE} />
                                : <ChevronRight style={CHEVRON_STYLE} />
                            }
                        </button>
                    </Tooltip.Trigger>
                    {tooltipContent && (
                        <Tooltip.Content placement='right' className={CONFIG_TOOLTIP_CLASS}>
                            {tooltipContent}
                        </Tooltip.Content>
                    )}
                </Tooltip>
            </MaybeContextMenu>

            {isExpanded && entry.state === 'loading' && !analysis.expectedArtifacts?.length && (
                <CanvasTreeSkeletonRows count={1} compact indent='lg' />
            )}

            {isExpanded && entry.state === 'error' && onRetryLoadExposures && (
                <AnalysisTreeRetryRow onRetry={() => onRetryLoadExposures(analysis._id)} />
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
                        isRasterSelectionMode={isRasterSelectionMode}
                        tourTargetId={key === firstExposureRowKey ? firstExposureTourTargetId : undefined}
                    />
                );
            })}

            {isExpanded && entry.state === 'loaded' && artifactRows.length === 0 && (
                <CanvasTreeEmptyRow label='No models' indent='lg' />
            )}
        </>
    );
};

export default AnalysisTreeNode;
