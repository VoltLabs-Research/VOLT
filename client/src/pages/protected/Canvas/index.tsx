/**
 * Página principal del editor usando los nuevos stores
 */
import React, { useRef } from 'react';
import Scene3D, { type Scene3DRef } from '@/components/organisms/Scene3D';
import TimestepControls from '@/components/organisms/TimestepControls';
import AnalysisConfiguration from '@/components/organisms/AnalysisConfiguration';
import SlicePlane from '@/components/organisms/SlicePlane';
import EditorSidebar from '@/components/organisms/EditorSidebar';
import AutoPreviewSaver from '@/components/atoms/scene/AutoPreviewSaver';
import TimestepViewer from '@/components/organisms/TimestepViewer';
import useCanvasCoordinator from '@/hooks/canvas/use-canvas-coordinator';
import { useParams } from 'react-router-dom';

const EditorPage: React.FC = () => {
    const { trajectoryId } = useParams<{ trajectoryId: string }>();
    const scene3DRef = useRef<Scene3DRef>(null);
    
    const {
        trajectory,
        currentTimestep,
    } = useCanvasCoordinator();

    if (!trajectory || currentTimestep === undefined) {
        return <div>Loading...</div>;
    }

    return (
        <div className="editor-page">
            <Scene3D ref={scene3DRef}>
                <TimestepViewer />
            </Scene3D>
            
            <EditorSidebar />
            <TimestepControls />
            <AnalysisConfiguration />
            <SlicePlane />
            
            {trajectoryId && (
                <AutoPreviewSaver
                    scene3DRef={scene3DRef}
                    trajectoryId={trajectoryId}
                />
            )}
        </div>
    );
};

export default EditorPage;