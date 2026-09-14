import { Button, cn } from '@heroui/react';
import { X } from 'lucide-react';
import { useEditorStore } from '@/modules/canvas/store/editor';
import Viewport from '../Viewport';
import { useShallow } from 'zustand/react/shallow';

import type { FractalSceneRef } from '@/modules/fractal/contracts/scene-ref';
import type { FractalSceneConfig } from '@/modules/fractal/contracts/scene-config';
import type { Trajectory } from '@volt/contracts/modules/trajectory/domain';
import type { ReactNode, RefObject } from 'react';

interface ViewportGridProps {
    trajectory: Trajectory | null | undefined;
    currentTimestep: number | undefined;
    sceneConfig: FractalSceneConfig;
    analysisId: string | undefined;
    forcedGlbUrl?: string | null;
    showGrid: boolean;
    showGizmo: boolean;
    sceneRef: RefObject<FractalSceneRef | null>;
    bodyContent?: ReactNode;
    analysisOverlay?: ReactNode;
    renderScene: boolean;
}

const gridClassName = (count: number): string => {
    if (count <= 1) {
        return 'grid-cols-1 grid-rows-1';
    }

    if (count === 2) {
        return 'grid-cols-2 grid-rows-1 max-md:grid-cols-1 max-md:grid-rows-2';
    }

    return 'grid-cols-2 grid-rows-2';
};

const ViewportGrid = ({
    trajectory,
    currentTimestep,
    sceneConfig,
    analysisId,
    forcedGlbUrl,
    showGrid,
    showGizmo,
    sceneRef,
    bodyContent,
    analysisOverlay,
    renderScene
}: ViewportGridProps) => {
    const {
        viewportPanes,
        focusedViewportPaneId,
        focusViewportPane,
        closeViewportPane
    } = useEditorStore(useShallow((state) => ({
        viewportPanes: state.viewportPanes,
        focusedViewportPaneId: state.focusedViewportPaneId,
        focusViewportPane: state.focusViewportPane,
        closeViewportPane: state.closeViewportPane
    })));

    return (
        <div className='relative flex min-h-0 w-full flex-1 flex-col overflow-hidden'>
            {viewportPanes.length <= 1 ? (
                <Viewport
                    trajectory={trajectory}
                    currentTimestep={currentTimestep}
                    sceneConfig={sceneConfig}
                    analysisId={analysisId}
                    forcedGlbUrl={forcedGlbUrl}
                    showGrid={showGrid}
                    showGizmo={showGizmo}
                    sceneRef={sceneRef}
                    bodyContent={bodyContent}
                    renderScene={renderScene}
                />
            ) : (
                <div className={cn('grid min-h-0 w-full flex-1 gap-px bg-border', gridClassName(viewportPanes.length))}>
                    {viewportPanes.map((pane, index) => {
                        const focused = pane.id === focusedViewportPaneId;
                        return (
                            <div
                                key={pane.id}
                                className={cn(
                                    'relative flex min-h-0 min-w-0 flex-col overflow-hidden bg-background',
                                    focused ? 'ring-1 ring-inset ring-accent' : 'ring-0'
                                )}
                                onPointerDown={() => focusViewportPane(pane.id)}
                            >
                                <div className='pointer-events-none absolute left-2 top-2 z-[3] rounded-md bg-surface-secondary px-1.5 py-0.5 text-2xs font-medium text-muted'>
                                    Pane {index + 1}
                                </div>
                                <div className='absolute right-1.5 top-1.5 z-[3]'>
                                    <Button
                                        variant='ghost'
                                        size='sm'
                                        isIconOnly
                                        aria-label={`Close pane ${index + 1}`}
                                        onPress={() => closeViewportPane(pane.id)}
                                    >
                                        <X size={12} aria-hidden='true' />
                                    </Button>
                                </div>
                                <Viewport
                                    trajectory={trajectory}
                                    currentTimestep={currentTimestep}
                                    sceneConfig={sceneConfig}
                                    analysisId={pane.analysisId ?? analysisId}
                                    forcedGlbUrl={forcedGlbUrl}
                                    showGrid={showGrid}
                                    showGizmo={showGizmo}
                                    sceneRef={focused ? sceneRef : { current: null }}
                                    bodyContent={focused ? bodyContent : undefined}
                                    renderScene={renderScene}
                                    paneScenes={pane.scenes}
                                    paneMergeGroups={pane.mergeGroups}
                                    paneAnalysisId={pane.analysisId}
                                    screenshotEnabled={focused}
                                    playbackEnabled={focused}
                                />
                            </div>
                        );
                    })}
                </div>
            )}
            {analysisOverlay}
        </div>
    );
};

export default ViewportGrid;
