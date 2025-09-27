import React, { memo, useEffect, useRef, useState } from 'react';
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

    const [isLight, setIsLight] = useState(() =>
        typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'light'
    );

    useEffect(() => {
        if (typeof document === 'undefined') return;
        const root = document.documentElement;
        const update = () => setIsLight(root.getAttribute('data-theme') === 'light');
        update();
        const observer = new MutationObserver(update);
        observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
        return () => observer.disconnect();
    }, []);

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
                                <div className='badge-container scene-preview-name-badge primary-surface'>
                                    <p className='badge-text'>{trajectory.name}</p>
                                </div>
                                
                                <div className='badge-container scene-preview-natoms-badge primary-surface'>
                                    <p className='badge-text'>
                                        {formatNumber((trajectory.frames || []).find((f: any) => f.timestep === currentTimestep)?.natoms ?? 0)} atoms
                                    </p>
                                </div>

                                <div className='badge-container scene-preview-navigate-icon primary-surface'>
                                    <GoArrowRight />
                                </div>
                            </>
                        )}

                        <Scene3D 
                            key={selectedTeam?._id || 'no-team'}
                            showGizmo={false}
                            ref={scene3DRef}
                            {...(isLight ? { background: '#f8f8f8ff' } : {})}
                            showCanvasGrid={false}
                            orbitControlsConfig={{
                                enablePan: false,
                                enableZoom: false
                            }}
                        >
                            <TimestepViewer />
                        </Scene3D>

                        {/* JobsHistory pinned inside the 3D scene */}
                        <JobsHistoryViewer />
                    </div>
                </div>

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