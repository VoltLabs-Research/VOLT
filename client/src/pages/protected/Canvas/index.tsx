/**
* Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
*
* Permission is hereby granted, free of charge, to any person obtaining a copy
* of this software and associated documentation files (the "Software"), to deal
* in the Software without restriction, including without limitation the rights
* to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
* copies of the Software, and to permit persons to whom the Software is
* furnished to do so, subject to the following conditions:
*
* The above copyright notice and this permission notice shall be included in all
* copies or substantial portions of the Software.
*
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
* IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
* FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
* AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
* LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
* OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
* SOFTWARE.
**/

import React, { useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import type { TrajectoryData } from '@/types/canvas';
import Scene3D from '@/components/organisms/Scene3D';
import TimestepViewer from '@/components/organisms/TimestepViewer';
import FileUpload from '@/components/molecules/FileUpload';
import useCanvasState from '@/hooks/canvas/useCanvasState';
import LoadingOverlay from '@/components/atoms/LoadingOverlay';
import CanvasWidgets from '@/components/atoms/CanvasWidgets';
import AutoPreviewSaver from '@/components/atoms/scene/AutoPreviewSaver';
import useTrajectoryManager from '@/hooks/trajectory/useTrajectoryManager';
import './Canvas.css';

const CANVAS_CONFIG = {
    autoSaveDelay: 2000,
    timestepViewerDefaults: {
        scale: 1,
        rotation: { x: Math.PI / 2 },
        position: { x: 0, y: 0, z: 0 }
    }
} as const;

const CanvasPage: React.FC = () => {
    const { trajectoryId } = useParams<{ trajectoryId: string }>();
    const { trajectory, currentTimestep, selectTrajectory, hasModel } = useCanvasState(trajectoryId);
    const { isLoading } = useTrajectoryManager();
    const scene3DRef = useRef(null);

    const handleTrajectoryUpload = useCallback((trajectoryData: TrajectoryData) => {
        try{
            selectTrajectory(trajectoryData);
        }catch(err){
            console.error('Error selecting trajectory:', error);
        }
    }, [selectTrajectory]);

    return (
        <main className='editor-container'>
            <CanvasWidgets trajectory={trajectory} currentTimestep={currentTimestep} />
            
            {isLoading && <LoadingOverlay />}

            <div className='editor-timestep-viewer-container'>
                <FileUpload onUploadSuccess={handleTrajectoryUpload}>
                    <Scene3D ref={scene3DRef}>
                        <AutoPreviewSaver
                            scene3DRef={scene3DRef}
                            delay={CANVAS_CONFIG.autoSaveDelay}
                            trajectoryId={trajectoryId}
                        />

                        {hasModel && (
                            <TimestepViewer
                                scale={CANVAS_CONFIG.timestepViewerDefaults.scale}
                                rotation={CANVAS_CONFIG.timestepViewerDefaults.rotation}
                                position={CANVAS_CONFIG.timestepViewerDefaults.position}
                            />
                        )}
                    </Scene3D>
                </FileUpload>
            </div>
        </main>
    );
};

export default CanvasPage;