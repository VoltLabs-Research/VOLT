import React, { useEffect, useRef } from 'react';
import Scene3D from '@/components/organisms/Scene3D';
import TimestepViewer from '@/components/organisms/TimestepViewer';
import useEditorStore from '@/stores/editor';
import useTrajectoryStore from '@/stores/trajectories';
import Loader from '@/components/atoms/Loader';
import { GoArrowUpRight } from "react-icons/go";
import './TrajectoryPreview.css';

const TrajectoryPreview = () => {
    const selectTrajectory = useEditorStore((state) => state.selectTrajectory);
    const trajectory = useTrajectoryStore((state) => state.trajectory);
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
            {(isModelLoading || trajectories.length === 0) ? (
                <div className='trajectory-preview-loading-container'>
                    <Loader scale={0.6} />
                </div>
            ) : (
                <>
                    <div className='trajectory-preview-item-container trajectory-preview-name-container'>
                        <i className='trajectory-name-icon-container' />
                        <h3 className='trajectory-name'>{trajectory?.name}</h3>
                    </div>

                    <div className='trajectory-preview-item-container trajectory-preview-navigate-container'>
                        <h3 className='trajectory-navigate'>View</h3>
                        <i className='trajectory-navigate-icon-container'>
                            <GoArrowUpRight />
                        </i>
                    </div>
                </>
            )}
            <div className='trajectory-preview-scene-container'>
                <Scene3D showGizmo={false}>
                    <TimestepViewer
                        scale={0.9}
                        rotation={{ x: Math.PI / 2 }}
                        position={{ x: 0, y: 0, z: 0 }}
                    />
                </Scene3D> 
            </div>      
        </div>
    );
};

export default TrajectoryPreview;