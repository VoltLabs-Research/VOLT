import { ChevronDown, ChevronRight, Download, Atom, MousePointerClick, Trash2 } from 'lucide-react';
import {
    DEFAULT_DISLOCATION_LINE_WIDTH,
    buildPluginScene,
    buildSceneRenderMetadata
} from '../../utilities/plugin-exposure-export';
import { isSameScene } from '@/modules/canvas/utilities/scene-identity';
import { getSceneKey } from '@/modules/fractal/utilities/scene-utils';
import { Exporter } from '@/modules/plugin/api/entities/plugin/workflow-enums';
import {
    AnalysisTreeRetryRow,
    CanvasTreeEmptyRow,
    CanvasTreeRow,
    CanvasTreeSkeletonRows,
    MaybeContextMenu
} from '../CanvasTree';
import {
    buildAddRemoveOption,
    buildLineWidthSubmenu,
    buildTransparencySubmenu,
    lineSettingsOption,
    transparencyOption
} from '../../utilities/tree-menus';
import Button from '@/shared/presentation/primitives/Button';
import Tooltip from '@/shared/presentation/primitives/Tooltip';
import ExecutionConfigSummary from './ExecutionConfigSummary';
import { CanvasAnalysisStatusEnum, isCanvasAnalysisInProgress, normalizeCanvasAnalysisStatus } from '../../utilities/analysis-status';
import { useMemo } from 'react';

import type { AnalysisSectionData } from '../../hooks/use-canvas-sidebar-scene';
import type { CanvasAnalysisStatus } from '../../utilities/analysis-status';
import type { AnalysisActivityTone } from '../../hooks/use-analysis-activity-tone';
import type { Analysis } from '@/modules/analysis/api/entities/analysis';
import type { SceneObjectType, SceneRenderMetadata, SceneVisualOverrides } from '@/modules/fractal/api/entities/scene';
import type { RasterSelectableScene } from '@/modules/raster/types/container-selection';
import type { MenuOption } from '@/shared/presentation/types/menu';

interface AnalysisTreeNodeProps {
    section: AnalysisSectionData;
    status?: CanvasAnalysisStatus;
    tone?: AnalysisActivityTone;
    isExpanded: boolean;
    onToggle: (id: string) => void;
    onSelectScene: (scene: SceneObjectType, analysis?: Analysis) => void;
    isSceneActive: (scene: SceneObjectType) => boolean;
    onAddScene: (scene: SceneObjectType) => void;
    onRemoveScene: (scene: SceneObjectType) => void;
    onDeleteAnalysis: (analysisId: string) => Promise<void>;
    onDownloadAnalysis: (analysisId: string) => void | Promise<void>;
    onDownloadExposureListing?: (params: {
        pluginId: string;
        exposureId: string;
        analysisId?: string;
        trajectoryId?: string;
        exposureName?: string;
    }) => void;
    onRetryLoadExposures?: (analysisId: string) => void;
    sceneVisualOverrides: SceneVisualOverrides;
    setSceneOpacity: (sceneKey: string, opacity: number) => void;
    setSceneLineWidth: (sceneKey: string, lineWidth: number) => void;
    resolveSceneRenderMetadata?: (pluginId: string, exposureId: string) => SceneRenderMetadata | undefined;
    selectionMode?: 'default' | 'raster';
    selectedScene?: RasterSelectableScene | null;
    onSelectRasterScene?: (scene: RasterSelectableScene, label: string) => void;
}

const SCENE_ICON_COLOR = 'var(--accent-blue)';

const AnalysisTreeNode = ({
    section,
    status,
    tone,
    isExpanded,
    onToggle,
    onSelectScene,
    isSceneActive,
    onAddScene,
    onRemoveScene,
    onDeleteAnalysis,
    onDownloadAnalysis,
    onDownloadExposureListing,
    onRetryLoadExposures,
    sceneVisualOverrides,
    setSceneOpacity,
    setSceneLineWidth,
    resolveSceneRenderMetadata,
    selectionMode = 'default',
    selectedScene,
    onSelectRasterScene
}: AnalysisTreeNodeProps) => {
    const { analysis, pluginDisplayName, entry, isCurrentAnalysis, userConfig } = section;
    const isRasterSelectionMode = selectionMode === 'raster';
    const hasExposures = entry.state === 'loaded' && entry.exposures.length > 0;
    const fallbackStatus = normalizeCanvasAnalysisStatus(analysis.status);
    const resolvedStatus = status ?? fallbackStatus;
    const isAnalysisInProgress = isCanvasAnalysisInProgress(resolvedStatus);
    const canDownloadAnalysis = resolvedStatus === CanvasAnalysisStatusEnum.Completed;
    const isSelectedAnalysis = isRasterSelectionMode
        ? selectedScene?.source === 'plugin' && 'analysisId' in selectedScene && selectedScene.analysisId === analysis._id
        : isCurrentAnalysis;

    const hasConfig = useMemo(() => Object.keys(userConfig ?? {}).length > 0, [userConfig]);

    const tooltipContent = useMemo(() => {
        if (!isAnalysisInProgress && !hasConfig) return null;

        return (
            <div className='canvas-tree-config-tooltip__content'>
                {isAnalysisInProgress && (
                    <div className='canvas-tree-config-tooltip__warning'>
                        Analysis still running. Some options will be disabled until it finishes.
                    </div>
                )}
                <div className='canvas-tree-config-tooltip__body'>
                    {hasConfig ? (
                        <ExecutionConfigSummary config={userConfig ?? {}} />
                    ) : (
                        <div className='canvas-tree-config-tooltip__empty'>No execution config captured for this analysis.</div>
                    )}
                </div>
            </div>
        );
    }, [hasConfig, isAnalysisInProgress, userConfig]);

    const handleSelectAnalysis = () => {
        if (isAnalysisInProgress) return;

        if (isRasterSelectionMode) {
            onToggle(analysis._id);
            return;
        }

        if (isSelectedAnalysis) {
            onSelectScene({ sceneType: 'trajectory', source: 'default' as const });
        } else {
            onToggle(analysis._id);
            onSelectScene({ sceneType: 'trajectory', source: 'default' as const }, analysis);
        }
    };

    const analysisMenuOptions: MenuOption[] = [
        { label: isSelectedAnalysis ? 'Deselect' : 'Select', icon: MousePointerClick, onClick: handleSelectAnalysis, disabled: isAnalysisInProgress },
        { label: 'Download', icon: Download, onClick: () => onDownloadAnalysis(analysis._id), disabled: !canDownloadAnalysis },
        { label: 'Delete', icon: Trash2, onClick: () => onDeleteAnalysis(analysis._id), destructive: true }
    ];

    const nameClassName = [
        'canvas-tree-analysis-name',
        'truncate',
        isSelectedAnalysis ? 'color-primary' : 'color-secondary',
        tone ? `canvas-tree-analysis-name--${tone}` : ''
    ].filter(Boolean).join(' ');

    const analysisRow = (
        <div className={`canvas-tree-item font-size-1 d-flex items-center gap-05 color-secondary u-select-none canvas-tree-item--indent ${isSelectedAnalysis ? 'selected' : ''} ${isAnalysisInProgress ? 'is-disabled' : 'cursor-pointer'}`} onClick={handleSelectAnalysis} role="treeitem" aria-selected={isSelectedAnalysis} aria-disabled={isAnalysisInProgress} tabIndex={isAnalysisInProgress ? -1 : 0}>
            <span className={nameClassName} title={pluginDisplayName}>
                {pluginDisplayName}
            </span>
            <span className="flex-1" />
            <Button
                variant='ghost'
                intent='neutral'
                iconOnly
                size='sm'
                onClick={(e) => {
                    if (isAnalysisInProgress) return;
                    e.stopPropagation();
                    onToggle(analysis._id);
                }}
                className="canvas-tree-toggle b-none p-0"
                aria-label={isExpanded ? 'Collapse' : 'Expand'}
                disabled={isAnalysisInProgress}
            >
                {isExpanded
                    ? <ChevronDown style={{ width: 13, height: 13 }} />
                    : <ChevronRight style={{ width: 13, height: 13 }} />
                }
            </Button>
        </div>
    );

    const analysisTrigger = (
        <Tooltip content={tooltipContent} disabled={!tooltipContent} placement='right-start' className='canvas-tree-config-tooltip'>
            {analysisRow}
        </Tooltip>
    );

    return (
        <>
            <MaybeContextMenu
                enabled={!isRasterSelectionMode}
                id={`canvas-ctx-analysis-${analysis._id}`}
                options={analysisMenuOptions}
            >
                {analysisTrigger}
            </MaybeContextMenu>

            {isExpanded && entry.state === 'loading' && (
                <CanvasTreeSkeletonRows count={1} compact indent='lg' />
            )}

            {isExpanded && entry.state === 'error' && onRetryLoadExposures && (
                <AnalysisTreeRetryRow onRetry={() => onRetryLoadExposures(analysis._id)} />
            )}

            {isExpanded && hasExposures && entry.exposures.map((exposure) => {
                const sceneRenderMetadata = buildSceneRenderMetadata(exposure.export)
                    ?? resolveSceneRenderMetadata?.(section.pluginId, exposure.exposureId);
                const scene = buildPluginScene({
                    analysisId: exposure.analysisId,
                    exposureId: exposure.exposureId,
                    sceneRenderMetadata
                });
                const isActive = isRasterSelectionMode
                    ? isSameScene(selectedScene, scene)
                    : isSceneActive(scene);
                const sceneKey = getSceneKey(scene);
                const sceneOverride = sceneVisualOverrides[sceneKey];
                const currentOpacity = sceneOverride?.opacity ?? 1;
                const isDislocationExposure = sceneRenderMetadata?.exporter === Exporter.DISLOCATION;
                const defaultLineWidth = sceneRenderMetadata?.defaultLineWidth ?? DEFAULT_DISLOCATION_LINE_WIDTH;
                const currentLineWidth = sceneOverride?.lineWidth ?? defaultLineWidth;

                const exposureMenuOptions: MenuOption[] = [
                    buildAddRemoveOption({
                        isActive,
                        onAdd: () => onAddScene(scene),
                        onRemove: () => onRemoveScene(scene)
                    }),
                    {
                        label: 'Download',
                        icon: Download,
                        onClick: () => {
                            onDownloadExposureListing?.({
                                pluginId: section.pluginId,
                                exposureId: exposure.exposureId,
                                analysisId: analysis._id,
                                exposureName: exposure.name
                            });
                        }
                    },
                    transparencyOption(buildTransparencySubmenu(exposure.name, currentOpacity, (value) => setSceneOpacity(sceneKey, value))),
                    ...(isDislocationExposure
                        ? [lineSettingsOption(buildLineWidthSubmenu(exposure.name, currentLineWidth, defaultLineWidth, (value) => setSceneLineWidth(sceneKey, value)))]
                        : [])
                ];

                const exposureTrigger = (
                    <CanvasTreeRow
                        indent='lg'
                        isActive={isActive}
                        icon={<Atom style={{ width: 12, height: 12, color: SCENE_ICON_COLOR }} />}
                        label={exposure.name}
                        onClick={() => {
                            if (isRasterSelectionMode) {
                                onSelectRasterScene?.(scene, exposure.name);
                                return;
                            }
                            onSelectScene(scene, analysis);
                        }}
                    />
                );

                return (
                    <MaybeContextMenu
                        key={exposure.exposureId}
                        enabled={!isRasterSelectionMode}
                        id={`canvas-ctx-exposure-${exposure.analysisId}-${exposure.exposureId}`}
                        options={exposureMenuOptions}
                    >
                        {exposureTrigger}
                    </MaybeContextMenu>
                );
            })}

            {isExpanded && entry.state === 'loaded' && entry.exposures.length === 0 && (
                <CanvasTreeEmptyRow label='No models' indent='lg' />
            )}
        </>
    );
};

export default AnalysisTreeNode;
