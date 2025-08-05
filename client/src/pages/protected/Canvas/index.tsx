/**
* Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
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
import TrajectoryVisibilityStatusFloatIcon from '@/components/atoms/scene/TrajectoryVisibilityStatusFloatIcon';
import SceneTopCenteredOptions from '@/components/atoms/scene/SceneTopCenteredOptions';
import DislocationResults from '@/components/atoms/DislocationResults';
import AnalysisConfiguration from '@/components/organisms/AnalysisConfiguration';
import AutoPreviewSaver from '@/components/atoms/scene/AutoPreviewSaver';
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
}) => {
    const currentDislocationData = useMemo(() => {
        if(!trajectory?.dislocations || !Array.isArray(trajectory.dislocations) || currentTimestep === undefined){
            return null;
        }
        
        return trajectory.dislocations.find((dislocation: any) => 
            dislocation.timestep === currentTimestep
        );
    }, [trajectory?.dislocations, currentTimestep]);

    return (
        <>
            <EditorSidebar />
            <TrajectoryVisibilityStatusFloatIcon />
            <SceneTopCenteredOptions />
            <SlicePlane />
            <AnalysisConfiguration />
            
            {(trajectory && currentTimestep !== undefined) && (
                <>
                    {currentDislocationData && (
                        <DislocationResults 
                            dislocationData={currentDislocationData}
                            onDislocationSelect={(segment) => {
                                console.log('Selected dislocation segment:', segment);
                            }}
                        />
                    )}
                    <TimestepControls />
                </>
            )}
        </>
    );
});

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
    const scene3DRef = useRef(null);
    
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
        console.log('Current trajectory:', trajectory);

        if(currentTrajectoryId === trajectoryId && trajectory) return;
        
        if(isInitialLoadDone.current && trajectoryIdRef.current === trajectoryId) return;

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
                    <Scene3D ref={scene3DRef}>
                        <AutoPreviewSaver scene3DRef={scene3DRef} delay={2000} trajectoryId={trajectoryId} />
                        {shouldShowTimestepViewer && <MemoizedTimestepViewer />}
                    </Scene3D>
                </FileUpload>
            </div>
        </main>
    );
};

export default EditorPage;