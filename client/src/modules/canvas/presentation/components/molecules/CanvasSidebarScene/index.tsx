import { memo } from 'react';
import Paragraph from '@/shared/presentation/components/Paragraph';

import useCanvasSidebarState from '@/modules/canvas/presentation/hooks/use-canvas-sidebar-state';

import AnalysisSearchInput from '@/modules/canvas/presentation/components/atoms/AnalysisSearchInput';
import BootstrapSkeleton from '@/modules/canvas/presentation/components/atoms/BootstrapSkeleton';
import DefaultSceneOption from '@/modules/canvas/presentation/components/molecules/DefaultSceneOption';
import AnalysisSection from '@/modules/canvas/presentation/components/organisms/AnalysisSection';

import '@/modules/canvas/presentation/components/molecules/CanvasSidebarScene/CanvasSidebarScene.css';

interface CanvasSidebarSceneProps {
    trajectory?: any | null;
    trajectoryId?: string;
}

const CanvasSidebarScene = memo(({ trajectory, trajectoryId: propTrajectoryId }: CanvasSidebarSceneProps) => {
    const {
        trajectoryId,
        searchQuery,
        setSearchQuery,
        expandedSections,
        headerPopoverStates,
        filteredSections,
        differingConfigByAnalysis,
        showSectionsSkeleton,
        headerPopoverCallbacks,
        activeScene,
        addScene,
        removeScene,
        onSelectScene,
        isSceneInActiveScenes,
        toggleSection,
        onDeleteAnalysis,
        isAnalysisInProgress,
        totalAnalyses,
        showEmptySearch
    } = useCanvasSidebarState({ trajectory, trajectoryId: propTrajectoryId });

    return (
        <div className='editor-sidebar-scene-container p-1-5'>
            <div className='editor-sidebar-scene-options-container d-flex gap-1 column'>
                <DefaultSceneOption
                    onSelect={onSelectScene}
                    onAdd={addScene}
                    onRemove={removeScene}
                    isSceneActive={isSceneInActiveScenes}
                />

                {totalAnalyses > 0 && (
                    <AnalysisSearchInput value={searchQuery} onChange={setSearchQuery} />
                )}

                {showSectionsSkeleton && (
                    <BootstrapSkeleton count={totalAnalyses} />
                )}

                {!showSectionsSkeleton && filteredSections.map((section) => (
                    <AnalysisSection
                        key={section.analysis._id}
                        section={section}
                        trajectoryId={trajectoryId!}
                        isExpanded={expandedSections.has(section.analysis._id)}
                        onToggle={toggleSection}
                        differingFields={differingConfigByAnalysis.get(section.analysis._id) || []}
                        headerPopoverCallbacks={headerPopoverCallbacks}
                        headerPopoverStates={headerPopoverStates}
                        onSelectScene={onSelectScene}
                        onAddScene={addScene}
                        onRemoveScene={removeScene}
                        isSceneActive={isSceneInActiveScenes}
                        activeScene={activeScene}
                        onDelete={onDeleteAnalysis}
                        isInProgress={isAnalysisInProgress(section.analysis._id)}
                    />
                ))}

                {showEmptySearch && (
                    <Paragraph className='color-muted font-size-1 text-center p-1'>
                        No analyses match your search
                    </Paragraph>
                )}
            </div>
        </div>
    );
});

CanvasSidebarScene.displayName = 'CanvasSidebarScene';

export default CanvasSidebarScene;
