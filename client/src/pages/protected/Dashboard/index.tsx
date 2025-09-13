import React, { memo, useRef } from 'react';
import DashboardContainer from '@/components/atoms/DashboardContainer';
import FileUpload from '@/components/molecules/FileUpload';
import useTeamJobs from '@/hooks/jobs/use-team-jobs';
import TimestepViewer from '@/components/organisms/TimestepViewer';
import Scene3D, { type Scene3DRef } from '@/components/organisms/Scene3D';
import useTrajectoryStore from '@/stores/trajectories';
import useCanvasCoordinator from '@/hooks/canvas/use-canvas-coordinator';
import { formatNumber } from '@/components/organisms/DocumentListing';
import { GoArrowRight } from 'react-icons/go';
import SimulationGrid from '@/components/molecules/SimulationGrid';
import DashboardStats from '@/components/atoms/DashboardStats';
import useTeamStore from '@/stores/team/team';
import JobsHistoryViewer from '@/components/organisms/JobsHistoryViewer';
import './Dashboard.css';

const DashboardPage: React.FC = memo(() => {
    useTeamJobs();
    const trajectories = useTrajectoryStore((state) => state.trajectories);
    const { trajectory, currentTimestep } = useCanvasCoordinator({ trajectoryId: trajectories?.[0]?._id });
    const scene3DRef = useRef<Scene3DRef>(null)
    const selectedTeam = useTeamStore((state) => state.selectedTeam);

    return (
        <FileUpload>            
            <DashboardContainer pageName='Dashboard' className='dashboard-wrapper-container'>
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
                            showCanvasGrid={false}
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