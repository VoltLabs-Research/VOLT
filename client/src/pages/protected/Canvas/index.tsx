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

import React, { useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import TimestepControls from '@/components/organisms/TimestepControls';
import Scene3D from '@/components/organisms/Scene3D';
import TimestepViewer from '@/components/organisms/TimestepViewer';
import FileUpload from '@/components/molecules/FileUpload';
import useTrajectoryStore from '@/stores/trajectories';
import useEditorStore from '@/stores/editor';
import Loader from '@/components/atoms/Loader';
import SlicePlane from '@/components/organisms/SlicePlane';
import EditorSidebar from '@/components/organisms/EditorSidebar';
import TrajectoryVisibilityStatusFloatIcon from '@/components/atoms/TrajectoryVisibilityStatusFloatIcon';
import SceneTopCenteredOptions from '@/components/atoms/SceneTopCenteredOptions';
import AnalysisConfiguration from '@/components/organisms/AnalysisConfiguration';
import useUIStore from '@/stores/ui';
import './Canvas.css';

const trajectorySelector = (state: any) => state.trajectory;
const isLoadingSelector = (state: any) => state.isLoading;
const getTrajectoryByIdSelector = (state: any) => state.getTrajectoryById;

const currentGlbUrlSelector = (state: any) => state.currentGlbUrl;
const currentTimestepSelector = (state: any) => state.currentTimestep;
const selectTrajectorySelector = (state: any) => state.selectTrajectory;
const isModelLoadingSelector = (state: any) => state.isModelLoading;

const showEditorWidgetsSelector = (state: any) => state.showEditorWidgets;

const EditorWidgets = React.memo(({ 
    trajectory, 
    currentTimestep 
}: { 
    trajectory: any; 
    currentTimestep: number | undefined; 
}) => (
    <>
        <EditorSidebar />
        <TrajectoryVisibilityStatusFloatIcon />
        <SceneTopCenteredOptions />
        <SlicePlane />
        <AnalysisConfiguration />
        
        {(trajectory && currentTimestep !== undefined) && (
            <TimestepControls />
        )}
    </>
));

const LoaderOverlay = React.memo(() => (
    <div className='loader-layer-container'>
        <Loader scale={0.7} />
    </div>
));

const MemoizedTimestepViewer = React.memo(() => (
    <TimestepViewer
        scale={1}
        rotation={{ x: Math.PI / 2 }}
        position={{ x: 0, y: 0, z: 0 }}
    />
));

const EditorPage: React.FC = () => {
    const trajectory = useTrajectoryStore(trajectorySelector);
    const isLoadingTrajectory = useTrajectoryStore(isLoadingSelector);
    const getTrajectoryById = useTrajectoryStore(getTrajectoryByIdSelector);
    
    const currentGlbUrl = useEditorStore(currentGlbUrlSelector);
    const currentTimestep = useEditorStore(currentTimestepSelector);
    const selectTrajectory = useEditorStore(selectTrajectorySelector);
    const isModelLoading = useEditorStore(isModelLoadingSelector);
    
    const showEditorWidgets = useUIStore(showEditorWidgetsSelector);

    const isInitialLoadDone = useRef(false);
    const { trajectoryId } = useParams<{ trajectoryId: string }>();

    const trajectoryIdRef = useRef(trajectoryId);
    const currentTrajectoryId = trajectory?._id;

    const handleTrajectorySelection = useCallback((trajectoryData: any) => {
        isInitialLoadDone.current = true;
        selectTrajectory(trajectoryData);
    }, [selectTrajectory]);

    const loadTrajectory = useCallback(async (id: string) => {
        if (isInitialLoadDone.current) return;
        
        isInitialLoadDone.current = true;
        const loadedTrajectory = await getTrajectoryById(id);
        
        const freshTrajectory = useTrajectoryStore.getState().trajectory;
        if (freshTrajectory) {
            selectTrajectory(freshTrajectory);
        }
    }, [getTrajectoryById, selectTrajectory]);

    useEffect(() => {
        selectTrajectory(null);
        isInitialLoadDone.current = false;
    }, [selectTrajectory]);

    useEffect(() => {
        if (!trajectoryId) return;
        
        if (currentTrajectoryId === trajectoryId && trajectory) return;
        
        if (isInitialLoadDone.current && trajectoryIdRef.current === trajectoryId) return;

        trajectoryIdRef.current = trajectoryId;
        
        loadTrajectory(trajectoryId);
    }, [trajectoryId, currentTrajectoryId, trajectory, loadTrajectory]);

    const shouldShowTimestepViewer = useMemo(() => 
        Boolean(currentGlbUrl), 
        [currentGlbUrl]
    );

    return (
        <main className='editor-container'>
            {showEditorWidgets && (
                <EditorWidgets 
                    trajectory={trajectory} 
                    currentTimestep={currentTimestep} 
                />
            )}

            {isLoadingTrajectory && <LoaderOverlay />}

            <div className='editor-timestep-viewer-container'>
                <FileUpload onUploadSuccess={handleTrajectorySelection}>
                    <Scene3D>
                        {shouldShowTimestepViewer && <MemoizedTimestepViewer />}
                    </Scene3D>
                </FileUpload>
            </div>
        </main>
    );
};

export default EditorPage;