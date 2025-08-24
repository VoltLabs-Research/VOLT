import React, { memo, useEffect, useRef } from 'react';
import DashboardContainer from '@/components/atoms/DashboardContainer';
import FileUpload from '@/components/molecules/FileUpload';
import useTeamJobs from '@/hooks/jobs/use-team-jobs';
import TimestepViewer from '@/components/organisms/TimestepViewer';
import Scene3D, { type Scene3DRef } from '@/components/organisms/Scene3D';
import useTrajectoryStore from '@/stores/trajectories';
import useCanvasCoordinator from '@/hooks/canvas/use-canvas-coordinator';
import { formatNumber } from '@/components/organisms/DocumentListing';
import './Dashboard.css';
import { GoArrowRight, GoArrowUpRight } from 'react-icons/go';
import TrajectoryPreview from '@/components/molecules/TrajectoryPreview';
import SimulationGrid from '@/components/molecules/SimulationGrid';
import DashboardStats from '@/components/atoms/DashboardStats';
import useTeamStore from '@/stores/team';
import JobsHistoryViewer from '@/components/organisms/JobsHistoryViewer';

const DashboardPage: React.FC = memo(() => {
    useTeamJobs();
    const trajectories = useTrajectoryStore((state) => state.trajectories);
    const { trajectory, currentTimestep } = useCanvasCoordinator({ trajectoryId: trajectories?.[0]?._id });
    const scene3DRef = useRef<Scene3DRef>(null)
    const selectedTeam = useTeamStore((state) => state.selectedTeam);

    useEffect(() => {
        console.log(trajectories);
    }, [trajectories]);

    return (
        <FileUpload>            
            <DashboardContainer pageName='Dashboard' className='dashboard-wrapper-container'>
                {/*<article className='dashboard-header-container'>
                    <div className='dashboard-header-left-container'>
                        <h3 className='dashboard-header-title'>Dashboard</h3>
                    </div>

                    <div className='dashboard-header-right-container'>
                        <div className='dashboard-clickables-container'>
                            {[IoNotificationsOutline].map((Icon, index) => (
                                <div className='dashboard-clickable-container' key={index}>
                                    <Icon />
                                </div>
                            ))}
                        </div>

                        <div className='search-container'>
                            <i className='search-icon-container'>
                                <IoSearchOutline />
                            </i>
                            <input placeholder='Search' className='search-input '/>
                        </div>

                        <div className='create-new-button-container'>
                            <i className='create-new-button-icon-container'>
                                <HiPlus />
                            </i>
                            <span className='create-new-button-title'>Create</span>
                            <i className='create-new-button-dropdown-icon-container'>
                                <MdKeyboardArrowDown />
                            </i>
                        </div>                    
                    </div>

                    <div className='dashboard-header-right-mobile-container'>
                        <div className='dashboard-clickables-container'>
                            {[IoNotificationsOutline].map((Icon, index) => (
                                <div className='dashboard-clickable-container' key={index}>
                                    <Icon />
                                </div>
                            ))}
                        </div>

                        <SidebarUserAvatar
                            onClick={toggleDashboardSidebar}
                            hideUsername={true}
                        />
                    </div>
                </article>
                
                {/*
                <DashboardStats teamId={teamId} />

                <div className='dashboard-main-container'>
                    <TrajectoryPreview />
                    <JobsHistoryViewer />
                </div>
                
                <SimulationGrid />
                */}

                <div className='dashboard-body-left-container'>
                    <div className='dashboard-body-left-header-container'>
                        <h3 className='dashboard-body-left-header-title'>Good Morning, Rodolfo</h3>
                    </div>

                    <div className='scene-preview-container'>
                        {(trajectory?._id && currentTimestep !== undefined) && (
                            <>
                                <div className='badge-container scene-preview-name-badge'>
                                    <p className='badge-text'>{trajectory.name}</p>
                                </div>
                                
                                <div className='badge-container scene-preview-natoms-badge'>
                                    <p className='badge-text'>{formatNumber(trajectory.frames[currentTimestep]?.natoms ?? 0)} atoms</p>
                                </div>

                                <div className='badge-container scene-preview-navigate-icon'>
                                    <GoArrowRight />
                                </div>
                            </>
                        )}

                        <Scene3D 
                            showGizmo={false}
                            ref={scene3DRef}
                            orbitControlsConfig={{
                                enablePan: false,
                                enableZoom: false
                            }}
                        >
                            <TimestepViewer />
                        </Scene3D>
                    </div>
                </div>

                <JobsHistoryViewer />

                <div className='dashboard-body-right-container'>
                    <DashboardStats teamId={selectedTeam?._id} />

                    <SimulationGrid />
                </div>
            </DashboardContainer>

            {/* <AIPromptBox /> */}
        </FileUpload>
    );
});

DashboardPage.displayName = 'DashboardPage';

export default DashboardPage;