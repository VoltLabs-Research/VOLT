import { ChevronDown, ChevronRight, Download, MousePointerClick, Trash2 } from 'lucide-react';
import {
    AnalysisTreeRetryRow,
    CanvasTreeEmptyRow,
    CanvasTreeSkeletonRows,
    MaybeContextMenu
} from '../CanvasTree';
import { Box, Button, Tooltip } from '@voltstack/bravais';
import { CanvasAnalysisStatusEnum, isCanvasAnalysisInProgress, normalizeCanvasAnalysisStatus } from '../../utils/analysis-status';
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
        <div className='canvas-tree-config-tooltip__content'>
            {isAnalysisInProgress && (
                <div className='canvas-tree-config-tooltip__warning'>
                    Analysis still running. Some options will be disabled until it finishes.
                </div>
            )}
            <div className='canvas-tree-config-tooltip__body'>
                {hasConfig || hasWorkflowPluginNodes ? (
                    <ExecutionConfigSummary
                        config={analysis.config}
                        plugin={plugin}
                        pluginsById={pluginsById}
                    />
                ) : (
                    <div className='canvas-tree-config-tooltip__empty'>No execution config captured for this analysis.</div>
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

    const nameClassName = [
        'canvas-tree-analysis-name',
        'truncate',
        isSelectedAnalysis ? 'color-primary' : 'color-secondary',
        tone ? `canvas-tree-analysis-name--${tone}` : ''
    ].filter(Boolean).join(' ');

    return (
        <>
            <MaybeContextMenu
                enabled={!isRasterSelectionMode}
                id={`canvas-ctx-analysis-${analysis._id}`}
                options={analysisMenuOptions}
            >
                <Tooltip content={tooltipContent} disabled={!tooltipContent} placement='right-start' className='canvas-tree-config-tooltip'>
                    <div className={`canvas-tree-item font-size-1 d-flex items-center gap-05 color-secondary u-select-none canvas-tree-item--indent ${isSelectedAnalysis ? 'selected' : ''} cursor-pointer`} onClick={handleSelectAnalysis} role="treeitem" aria-selected={isSelectedAnalysis} tabIndex={0} data-tour-id={tourTargetId}>
                        <span className="canvas-tree-analysis-label-group">
                            <span className={nameClassName} title={analysis.pluginDisplayName}>
                                {analysis.pluginDisplayName}
                            </span>
                            {inlineSummary && (
                                <span className="canvas-tree-analysis-config-hint truncate" title={inlineSummary}>
                                    {inlineSummary}
                                </span>
                            )}
                        </span>
                        <Box as='span' flex='1' />
                        <Button
                            variant='ghost'
                            intent='neutral'
                            iconOnly
                            size='sm'
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggle(analysis._id);
                            }}
                            className="canvas-tree-toggle b-none p-0"
                            aria-label={isExpanded ? 'Collapse' : 'Expand'}
                        >
                            {isExpanded
                                ? <ChevronDown style={CHEVRON_STYLE} />
                                : <ChevronRight style={CHEVRON_STYLE} />
                            }
                        </Button>
                    </div>
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
                        pluginId={analysis.plugin}
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
