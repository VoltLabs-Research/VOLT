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
import TimestepControls from '@/components/organisms/TimestepControls';
import Scene3D from '@/components/organisms/Scene3D';
import TimestepViewer from '@/components/organisms/TimestepViewer';
import FileUpload from '@/components/molecules/FileUpload';
import useTrajectoryStore from '@/stores/trajectories';
import useEditorStore from '@/stores/editor';
import Loader from '@/components/atoms/Loader';
import useTeamStore from '@/stores/team';
import TrajectoryList from '@/components/organisms/TrajectoryList';
import EditorWidget from '@/components/organisms/EditorWidget';
import SidebarUserAvatar from '@/components/atoms/SidebarUserAvatar';
import { MdKeyboardArrowDown } from 'react-icons/md';
import { LuPanelRight } from "react-icons/lu";
import { CiLock } from "react-icons/ci";
import { TbObjectScan } from "react-icons/tb";
import { PiLineSegmentThin, PiAtomThin, PiTriangleDashedThin } from "react-icons/pi";
import { SiTraefikmesh } from "react-icons/si";
import { LuLayoutDashboard } from "react-icons/lu";
import { IoIosColorFilter } from "react-icons/io";
import { GrHomeRounded } from "react-icons/gr";
import { MdOutlineLightMode } from "react-icons/md";
import { TbAugmentedReality2 } from "react-icons/tb";
import { GoDownload } from "react-icons/go";
import { CiShare1 } from "react-icons/ci";
import './Canvas.css';

const EditorPage: React.FC = () => {
    const trajectory = useTrajectoryStore((state) => state.trajectory);
    const isLoadingTrajectory = useTrajectoryStore((state) => state.isLoading);
    const getTrajectoryById = useTrajectoryStore((state) => state.getTrajectoryById);

    const currentGltfUrl = useEditorStore((state) => state.currentGltfUrl);
    const nextGltfUrl = useEditorStore((state) => state.nextGltfUrl);
    const currentTimestep = useEditorStore((state) => state.currentTimestep);
    const selectTrajectory = useEditorStore((state) => state.selectTrajectory);

    const selectedTeam = useTeamStore((state) => state.selectedTeam);

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
            <EditorWidget className='editor-sidebar-container'>
                <div className='editor-sidebar-top-container'>
                    <div className='editor-sidebar-header-container'>
                        <div className='editor-sidebar-trajectory-info-container'>
                            <div className='editor-sidebar-trajectory-info-header-container'>
                                <div className='editor-sidebar-trajectory-drop-container'>
                                    <h3 className='editor-sidebar-trajectory-name'>{trajectory?.name}</h3>
                                    <i className='editor-sidebar-trajectory-drop-icon-container'>
                                        <MdKeyboardArrowDown />
                                    </i>
                                </div>

                                <i className='editor-sidebar-panel-icon-container'>
                                    <LuPanelRight />
                                </i>
                            </div>
                            <p className='editor-sidebar-header-team-name'>{trajectory?.team?.name}</p>
                        </div>
                    </div>

                    <div className='editor-sidebar-options-wrapper-container'>
                        <div className='editor-sidebar-options-container'>
                            {['Scene', 'Modifiers'].map((option, index) => (
                                <div className={'editor-sidebar-option-container '.concat((index === 0) ? 'selected': '')} key={index}>
                                    <h3 className='editor-sidebar-option-title'>{option}</h3>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className='editor-sidebar-scene-container'>
                        <div className='editor-sidebar-scene-options-container'>
                            {[
                                [TbObjectScan, 'Camera 1'],
                                [PiLineSegmentThin, 'Dislocations'],
                                [SiTraefikmesh, 'Defect Mesh'],
                                [PiAtomThin, 'Dislocation Core Atoms'],
                                [PiTriangleDashedThin, 'Interface Mesh'],
                                [IoIosColorFilter, 'Structure Identification']
                            ].map(([ Icon, title ], index) => (
                                <div className='editor-sidebar-scene-option-container' key={index}>
                                    <i className='editor-sidebar-scene-option-icon-container'>
                                        <Icon />
                                    </i>
                                    <h3 className='editor-sidebar-scene-option-title'>{title}</h3>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className='editor-sidebar-bottom-container'>
                    <div className='editor-sidebar-user-avatar-wrapper'>
                        <SidebarUserAvatar />
                    </div>
                </div>
            </EditorWidget>

            <EditorWidget className='trajectory-share-status-container'>
                <i className='trajectory-share-status-icon-container'>
                    <CiLock />
                </i>
            </EditorWidget>

            <EditorWidget className='editor-top-centered-options-container'>
                {[
                    [GrHomeRounded, () => {}],
                    [MdOutlineLightMode, () => {}],
                    [LuLayoutDashboard, () => {}]
                ].map(([ Icon, callback ], index) => (
                    <i className={'editor-sidebar-scene-option-icon-container '.concat((index === 0) ? 'selected' : '')} key={index}>
                        <Icon />
                    </i>
                ))}

                <div className='editor-scene-zoom-container'>
                    <span className='editor-scene-zoom'>100%</span>
                    <i className='editor-scene-zoom-icon-container'>
                        <MdKeyboardArrowDown />
                    </i>
                </div>

                {[
                    [TbAugmentedReality2, () => {}],
                    [GoDownload, () => {}],
                    [CiShare1, () => {}]
                ].map(([ Icon, callback ], index) => (
                    <i className={'editor-sidebar-scene-option-icon-container '.concat((index === 0) ? 'selected' : '')} key={index}>
                        <Icon />
                    </i>
                ))}
            </EditorWidget>

            <TrajectoryList />

            {isLoadingTrajectory && (
                <div className='loader-layer-container'>
                    <Loader scale={0.7} />
                </div>
            )}

            {(trajectory && currentTimestep !== undefined) && (
                <TimestepControls />
            )}

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
        </main>
    );
};

export default EditorPage;