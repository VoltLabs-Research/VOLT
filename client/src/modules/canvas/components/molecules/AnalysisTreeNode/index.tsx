import { ChevronDown, ChevronRight, Download, Eye, FlaskConical, Atom, Minus, MousePointerClick, Plus, Trash2 } from 'lucide-react';
import { isSameScene } from '@/modules/canvas/utilities/scene-identity';
import { getSceneKey } from '@/modules/fractal/utilities/scene-utils';
import CanvasSlider from '../../atoms/CanvasSlider';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import ContextMenuPopover from '@/shared/presentation/components/ContextMenuPopover';
import Tooltip from '@/shared/presentation/components/Tooltip';
import { CanvasAnalysisStatusEnum, isCanvasAnalysisInProgress, normalizeCanvasAnalysisStatus } from '../../../utilities/analysis-status';

import type { AnalysisSectionData } from '../../../hooks/use-canvas-sidebar-scene';
import type { CanvasAnalysisStatus } from '../../../utilities/analysis-status';
import type { Analysis } from '@/modules/analysis/api/entities/analysis';
import type { SceneObjectType } from '@/modules/fractal/api/entities/scene';
import type { RasterSelectableScene } from '@/modules/raster/types/container-selection';
import type { MenuOption } from '@/shared/presentation/types/menu';

interface AnalysisTreeNodeProps {
    section: AnalysisSectionData;
    effectiveStatus?: CanvasAnalysisStatus;
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
    sceneOpacities: Record<string, number>;
    setSceneOpacity: (sceneKey: string, opacity: number) => void;
    selectionMode?: 'default' | 'raster';
    selectedScene?: RasterSelectableScene | null;
    onSelectRasterScene?: (scene: RasterSelectableScene, label: string) => void;
};

const ANALYSIS_ICON_COLOR = 'var(--color-text-secondary)';
const ANALYSIS_ICON_ACTIVE_COLOR = 'var(--color-text-primary)';
const SCENE_ICON_COLOR = 'var(--accent-blue)';

const AnalysisTreeNode = ({
    section,
    effectiveStatus,
    isExpanded,
    onToggle,
    onSelectScene,
    isSceneActive,
    onAddScene,
    onRemoveScene,
    onDeleteAnalysis,
    onDownloadAnalysis,
    onDownloadExposureListing,
    sceneOpacities,
    setSceneOpacity,
    selectionMode = 'default',
    selectedScene,
    onSelectRasterScene
}: AnalysisTreeNodeProps) => {
    const { analysis, pluginDisplayName, entry, isCurrentAnalysis } = section;
    const isRasterSelectionMode = selectionMode === 'raster';
    const hasExposures = entry.state === 'loaded' && entry.exposures.length > 0;
    const isLoading = entry.state === 'loading';
    const fallbackStatus = normalizeCanvasAnalysisStatus(analysis.status);
    const resolvedStatus = effectiveStatus ?? fallbackStatus;
    const isAnalysisInProgress = isCanvasAnalysisInProgress(resolvedStatus);
    const canDownloadAnalysis = resolvedStatus === CanvasAnalysisStatusEnum.Completed;
    const isSelectedAnalysis = isRasterSelectionMode
        ? selectedScene?.source === 'plugin' && 'analysisId' in selectedScene && selectedScene.analysisId === analysis._id
        : isCurrentAnalysis;

    const handleSelectAnalysis = () => {
        if (isAnalysisInProgress) {
            return;
        }

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
            disabled: !canDownloadAnalysis
        },
        {
            label: 'Delete',
            icon: Trash2,
            onClick: () => onDeleteAnalysis(analysis._id),
            destructive: true
        }
    ];

    const analysisTrigger = (
        <Container
            className={`canvas-tree-item font-size-1 d-flex items-center gap-05 color-secondary u-select-none canvas-tree-item--indent ${isSelectedAnalysis ? 'selected' : ''} ${isAnalysisInProgress ? 'is-disabled' : 'cursor-pointer'}`}
            onClick={handleSelectAnalysis}
            role="treeitem"
            aria-selected={isSelectedAnalysis}
            aria-disabled={isAnalysisInProgress}
            tabIndex={isAnalysisInProgress ? -1 : 0}
        >
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
            <FlaskConical style={{ width: 13, height: 13, color: isSelectedAnalysis ? ANALYSIS_ICON_ACTIVE_COLOR : ANALYSIS_ICON_COLOR }} />
            <span className={`${isSelectedAnalysis ? 'color-primary' : 'color-secondary'}`}>
                {pluginDisplayName}
            </span>
            <span className="flex-1" />
            {resolvedStatus && (
                <span className={`canvas-tree-status-dot canvas-tree-status-dot--${resolvedStatus} font-size-05`}>
                    ●
                </span>
            )}
        </Container>
    );

    return (
        <>
            {isRasterSelectionMode ? analysisTrigger : (
                <Tooltip content='Analysis still running. Some options will be disabled until it finishes.' disabled={!isAnalysisInProgress} placement='bottom'>
                    <ContextMenuPopover
                        id={`canvas-ctx-analysis-${analysis._id}`}
                        trigger={analysisTrigger}
                        options={analysisMenuOptions}
                        size='sm'
                    />
                </Tooltip>
            )}

            {isExpanded && isLoading && (
                <Container className="canvas-tree-item d-flex items-center gap-05 color-secondary canvas-tree-item--indent-lg">
                    <Container className="canvas-tree-skeleton canvas-tree-skeleton--compact" />
                </Container>
            )}

            {isExpanded && hasExposures && entry.exposures.map((exposure: { exposureId: string; analysisId: string; name: string }) => {
                const scene = {
                    sceneType: exposure.exposureId,
                    source: 'plugin' as const,
                    analysisId: exposure.analysisId,
                    exposureId: exposure.exposureId
                };
                const isActive = isRasterSelectionMode
                    ? isSameScene(selectedScene, scene)
                    : isSceneActive(scene);
                const sceneKey = getSceneKey(scene);
                const currentOpacity = sceneOpacities[sceneKey] ?? 1;

                const transparencySubmenu = (
                    <div className="context-menu-transparency">
                        <span className="context-menu-transparency__label">Transparency</span>
                        <CanvasSlider
                            ariaLabel={`Adjust ${exposure.name} transparency`}
                            min={0}
                            max={1}
                            step={0.01}
                            value={currentOpacity}
                            onChange={(value: number) => setSceneOpacity(sceneKey, value)}
                            ariaValueText={`${Math.round(currentOpacity * 100)}% opacity`}
                        />
                    </div>
                );

                const exposureMenuOptions: MenuOption[] = [
                    ...(isActive
                        ? [{
                            label: 'Remove from scene',
                            icon: Minus,
                            destructive: true,
                            onClick: () => onRemoveScene(scene)
                        }]
                        : [{
                            label: 'Add to scene',
                            icon: Plus,
                            onClick: () => onAddScene(scene)
                        }]
                    ),
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
                    {
                        label: 'Transparency',
                        icon: Eye,
                        submenuContent: transparencySubmenu
                    }
                ];

                const exposureTrigger = (
                    <button
                        className={`canvas-tree-item font-size-1 d-flex items-center gap-05 color-secondary cursor-pointer u-select-none canvas-tree-item--indent-lg ${isActive ? 'selected' : ''}`}
                        onClick={() => {
                            if (isRasterSelectionMode) {
                                onSelectRasterScene?.(scene, exposure.name);
                                return;
                            }

                            onSelectScene(scene, analysis);
                        }}
                        role="treeitem"
                        aria-selected={isActive}
                        type="button"
                    >
                        <span className="canvas-tree-spacer" />
                        <Atom style={{ width: 12, height: 12, color: SCENE_ICON_COLOR }} />
                        <span className={`${isActive ? 'color-primary' : 'color-secondary'}`}>
                            {exposure.name}
                        </span>
                    </button>
                );

                if (isRasterSelectionMode) {
                    return (
                        <Container key={exposure.exposureId}>
                            {exposureTrigger}
                        </Container>
                    );
                }

                return (
                    <ContextMenuPopover
                        key={exposure.exposureId}
                        id={`canvas-ctx-exposure-${exposure.analysisId}-${exposure.exposureId}`}
                        trigger={exposureTrigger}
                        options={exposureMenuOptions}
                        size='sm'
                    />
                );
            })}

            {isExpanded && entry.state === 'loaded' && entry.exposures.length === 0 && (
                <Container className="canvas-tree-item d-flex items-center gap-05 color-secondary canvas-tree-item--indent-lg">
                    <span className="color-muted font-size-1">No models</span>
                </Container>
            )}
        </>
    );
};

export default AnalysisTreeNode;
