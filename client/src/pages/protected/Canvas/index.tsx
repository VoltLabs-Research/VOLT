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

import React, { useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import TrajectoryList from '@/components/organisms/TrajectoryList';
import TimestepControls from '@/components/organisms/TimestepControls';
import AnalysisConfiguration from '@/components/organisms/AnalysisConfiguration';
import Scene3D from '@/components/organisms/Scene3D';
import TimestepViewer from '@/components/organisms/TimestepViewer';
import FileUpload from '@/components/molecules/FileUpload';
import useTrajectoryStore from '@/stores/trajectories';
import useEditorStore from '@/stores/editor';
import Loader from '@/components/atoms/Loader';
import './Canvas.css';

const EditorPage: React.FC = () => {
    const trajectory = useTrajectoryStore((state) => state.trajectory);
    const isLoadingTrajectory = useTrajectoryStore((state) => state.isLoading);
    const getTrajectoryById = useTrajectoryStore((state) => state.getTrajectoryById);

    const currentGltfUrl = useEditorStore((state) => state.currentGltfUrl);
    const nextGltfUrl = useEditorStore((state) => state.nextGltfUrl);
    const currentTimestep = useEditorStore((state) => state.currentTimestep);
    const selectTrajectory = useEditorStore((state) => state.selectTrajectory);

    const isInitialLoadDone = useRef(false);
    const { trajectoryId } = useParams<{ trajectoryId: string }>();
    
    useEffect(() => {
        if(trajectoryId && !trajectory?._id){
            getTrajectoryById(trajectoryId).then(() => {
                const loadedTrajectory = useTrajectoryStore.getState().trajectory;
                if(loadedTrajectory){
                    selectTrajectory(loadedTrajectory);
                }
            });
        }
    }, [trajectoryId, trajectory?._id, getTrajectoryById, selectTrajectory]);

    useEffect(() => {
        if(trajectoryId && !trajectory?._id && !isInitialLoadDone.current){
            isInitialLoadDone.current = true;
            getTrajectoryById(trajectoryId).then(() => {
                const loadedTrajectory = useTrajectoryStore.getState().trajectory;
                if(loadedTrajectory){
                    selectTrajectory(loadedTrajectory);
                }
            });
        }
    }, [trajectoryId, trajectory?._id, getTrajectoryById, selectTrajectory]);

    const handleTrajectorySelection = useCallback((trajectoryData: any) => {
        isInitialLoadDone.current = true;
        selectTrajectory(trajectoryData);
    }, [selectTrajectory]);

    return (
        <main className='editor-container'>
            <TrajectoryList onFileSelect={handleTrajectorySelection} />

            {isLoadingTrajectory && (
                <div className='loader-layer-container'>
                    <Loader scale={0.7} />
                </div>
            )}

            {(trajectory && currentTimestep !== undefined) && (
                <TimestepControls />
            )}

            <section className='editor-camera-info-container'>
                <h3 className='editor-camera-info-title'>Perspective Camera</h3>
                <p className='editor-camera-info-description'>
                    Timestep Visualization {currentTimestep ?? ''}
                    {trajectory && ` - ${trajectory.name}`}
                </p>
            </section>

            <div className='editor-timestep-viewer-container'>
                <FileUpload onUploadSuccess={handleTrajectorySelection}>
                    <Scene3D>
                        {currentGltfUrl && (
                            <TimestepViewer
                                currentGltfUrl={currentGltfUrl}
                                nextGltfUrl={nextGltfUrl}
                                scale={1}
                                rotation={{ x: Math.PI / 2 }}
                                position={{ x: 0, y: 0, z: 0 }}
                            />
                        )}
                    </Scene3D>
                </FileUpload>
            </div>

            <AnalysisConfiguration />
        </main>
    );
};

export default EditorPage;