import React, { useEffect, useRef } from 'react';
import Scene3D from '@/components/organisms/Scene3D';
import TimestepViewer from '@/components/organisms/TimestepViewer';
import useEditorStore from '@/stores/editor';
import useTrajectoryStore from '@/stores/trajectories';
import Loader from '@/components/atoms/Loader';
import './TrajectoryPreview.css';

const TrajectoryPreview = () => {
    const selectTrajectory = useEditorStore((state) => state.selectTrajectory);
    const isModelLoading = useEditorStore((state) => state.isModelLoading);
    const trajectories = useTrajectoryStore((state) => state.trajectories);
    const isPreviewRequested = useRef(false);

    useEffect(() => {
        if(!trajectories.length && !isPreviewRequested.current){
            return;
        }
        isPreviewRequested.current = true;
        selectTrajectory(trajectories[0]);
    }, [trajectories]);

    return (
        <div className='trajectory-preview-container'>
            {(isModelLoading || trajectories.length === 0) && (
                <div className='trajectory-preview-loading-container'>
                    <Loader scale={0.6} />
                </div>
            )}
            <Scene3D showGizmo={false}>
                <TimestepViewer
                    scale={1}
                    rotation={{ x: Math.PI / 2 }}
                    position={{ x: 0, y: 0, z: 0 }}
                />
            </Scene3D>            
        </div>
    );
};

export default TrajectoryPreview;