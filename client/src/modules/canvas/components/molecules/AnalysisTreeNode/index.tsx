import { ChevronDown, ChevronRight, FlaskConical, Atom } from 'lucide-react';
import Container from '@/shared/presentation/components/Container';
import Button from '@/shared/presentation/components/Button';
import Tooltip from '@/shared/presentation/components/Tooltip';
import ContextMenuPopover from '@/shared/presentation/components/ContextMenuPopover';
import type { AnalysisSectionData } from '../../../hooks/use-canvas-sidebar-scene';
import type { Analysis } from '@/modules/analysis/api/entities/analysis';
import type { SceneObjectType } from '@/modules/fractal/api/entities/fractal';
import type { MenuOption } from '@/shared/presentation/types/menu';

interface AnalysisTreeNodeProps {
    section: AnalysisSectionData;
    effectiveStatus?: string;
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
}

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
    onDownloadExposureListing
}: AnalysisTreeNodeProps) => {
    const { analysis, pluginDisplayName, entry, isCurrentAnalysis } = section;
    const hasExposures = entry.state === 'loaded' && entry.exposures.length > 0;
    const isLoading = entry.state === 'loading';
    const isAnalysisInProgress = effectiveStatus === 'running' || effectiveStatus === 'pending';
    const canDownloadAnalysis = effectiveStatus === 'completed' || analysis.status === 'completed';

    const handleSelectAnalysis = () => {
        if (isAnalysisInProgress) {
            return;
        }

        onToggle(analysis._id);
        onSelectScene({ sceneType: 'trajectory', source: 'default' as const }, analysis);
    };

    const analysisMenuOptions: MenuOption[] = [
        {
            label: 'Select',
            onClick: handleSelectAnalysis,
            disabled: isAnalysisInProgress
        },
        {
            label: 'Download',
            onClick: () => onDownloadAnalysis(analysis._id),
            disabled: !canDownloadAnalysis
        },
        {
            label: 'Delete',
            onClick: () => onDeleteAnalysis(analysis._id),
            destructive: true
        }
    ];

    const analysisTrigger = (
        <Container
            className={`canvas-tree-item font-size-1 d-flex items-center gap-05 color-secondary u-select-none canvas-tree-item--indent ${isCurrentAnalysis ? 'selected' : ''} ${isAnalysisInProgress ? 'is-disabled' : 'cursor-pointer'}`}
            onClick={handleSelectAnalysis}
            role="treeitem"
            aria-selected={isCurrentAnalysis}
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
            <FlaskConical style={{ width: 13, height: 13, color: isCurrentAnalysis ? 'rgba(255, 255, 255, 0.85)' : 'rgba(255, 255, 255, 0.3)' }} />
            <span className={`${isCurrentAnalysis ? 'color-primary' : 'color-secondary'}`}>
                {pluginDisplayName}
            </span>
            <span className="flex-1" />
            {effectiveStatus && effectiveStatus !== 'idle' && (
                <span className={`canvas-tree-status-dot canvas-tree-status-dot--${effectiveStatus} font-size-05`}>
                    ●
                </span>
            )}
        </Container>
    );

    return (
        <>
            <Tooltip content='Analysis still running. Some options will be disabled until it finishes.' disabled={!isAnalysisInProgress} placement='bottom'>
                <ContextMenuPopover
                    id={`canvas-ctx-analysis-${analysis._id}`}
                    trigger={analysisTrigger}
                    options={analysisMenuOptions}
                    size='sm'
                />
            </Tooltip>

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
                const isActive = isSceneActive(scene);

                return (
                    <ContextMenuPopover
                        key={exposure.exposureId}
                        id={`canvas-ctx-exposure-${exposure.analysisId}-${exposure.exposureId}`}
                        trigger={(
                            <Container
                                className={`canvas-tree-item font-size-1 d-flex items-center gap-05 color-secondary cursor-pointer u-select-none canvas-tree-item--indent-lg ${isActive ? 'selected' : ''}`}
                                onClick={() => {
                                    onSelectScene(scene, analysis);
                                }}
                                role="treeitem"
                                aria-selected={isActive}
                                tabIndex={0}
                            >
                                <span className="canvas-tree-spacer" />
                                <Atom style={{ width: 12, height: 12, color: '#60a5fa' }} />
                                <span className={`${isActive ? 'color-primary' : 'color-secondary'}`}>
                                    {exposure.name}
                                </span>
                            </Container>
                        )}
                        options={[
                            {
                                label: 'Add to scene',
                                onClick: () => onAddScene(scene),
                                disabled: isActive
                            },
                            {
                                label: 'Remove from scene',
                                onClick: () => onRemoveScene(scene),
                                disabled: !isActive
                            },
                            {
                                label: 'Download',
                                onClick: () => {
                                    onDownloadExposureListing?.({
                                        pluginId: section.pluginId,
                                        exposureId: exposure.exposureId,
                                        analysisId: analysis._id,
                                        exposureName: exposure.name
                                    });
                                }
                            }
                        ]}
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
