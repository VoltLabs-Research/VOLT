import { useState } from 'react';
import { Layers, SlidersHorizontal } from 'lucide-react';
import PanelHeader from '../../atoms/PanelHeader';
import Container from '@/shared/presentation/components/Container';
import CollapsibleSection from '@/shared/presentation/components/CollapsibleSection';
import IconButton from '@/shared/presentation/components/IconButton';
import useCanvasSidebarState from '../../../hooks/use-canvas-sidebar-state';
import useAnalysisStatus from '../../../hooks/use-analysis-status';
import type { Trajectory } from '@/modules/trajectory/domain/entities/Trajectory';
import SceneCollection from '../../molecules/SceneCollection';
import './ObjectsPanel.css';

interface ObjectsPanelProps {
    trajectory: Trajectory | null | undefined;
}

const ObjectsPanel = ({ trajectory }: ObjectsPanelProps) => {
    const [sceneCollectionOpen, setSceneCollectionOpen] = useState(true);

    const {
        filteredSections,
        expandedSections,
        toggleSection,
        showSectionsSkeleton,
        activeScene,
        onSelectScene,
        isSceneInActiveScenes,
        addScene,
        removeScene,
        totalAnalyses
    } = useCanvasSidebarState({ trajectory, trajectoryId: trajectory?._id });

    const { statusMap } = useAnalysisStatus({ trajectoryId: trajectory?._id, enabled: !!trajectory?._id });

    return (
        <Container className="canvas-objects-panel d-flex column">
            <PanelHeader
                icon={<Layers style={{ width: 13, height: 13, color: 'rgba(255,255,255,0.35)' }} />}
                title="Objects"
                actions={
                    <IconButton variant="ghost" size="sm" aria-label="Filter">
                        <SlidersHorizontal style={{ width: 13, height: 13 }} />
                    </IconButton>
                }
            />

            <CollapsibleSection
                title="Scene Collection"
                icon={<Layers style={{ width: 13, height: 13, color: 'rgba(255,255,255,0.25)' }} />}
                expanded={sceneCollectionOpen}
                onExpandedChange={setSceneCollectionOpen}
                className="canvas-right-dropdown"
                headerClassName="canvas-right-dropdown-header d-flex items-center gap-05"
                titleClassName="canvas-right-dropdown-title font-size-05 color-muted"
                iconClassName="canvas-right-dropdown-icon"
                bodyClassName="canvas-right-dropdown-body"
                contentClassName="d-flex column"
                noSpacing
                arrowSize={13}
                useDefaultHeaderStyles={false}
                useDefaultTitleStyles={false}
            >
                <SceneCollection
                    trajectory={trajectory}
                    filteredSections={filteredSections}
                    expandedSections={expandedSections}
                    toggleSection={toggleSection}
                    showSectionsSkeleton={showSectionsSkeleton}
                    activeScene={activeScene}
                    onSelectScene={onSelectScene}
                    isSceneInActiveScenes={isSceneInActiveScenes}
                    addScene={addScene}
                    removeScene={removeScene}
                    totalAnalyses={totalAnalyses}
                    statusMap={statusMap}
                />
            </CollapsibleSection>
        </Container>
    );
};

export default ObjectsPanel;
