import React, { memo, useEffect, useRef, useState, useMemo } from 'react';
import DashboardContainer from '@/components/atoms/dashboard/DashboardContainer';
import FileUpload from '@/components/molecules/common/FileUpload';
import useTeamJobs from '@/hooks/jobs/use-team-jobs';
import useTrajectoryUpdates from '@/hooks/trajectory/use-trajectory-updates';
import TimestepViewer from '@/components/organisms/scene/TimestepViewer';
import Scene3D, { type Scene3DRef } from '@/components/organisms/scene/Scene3D';
import useTrajectoryStore from '@/stores/trajectories';
import useCanvasCoordinator from '@/hooks/canvas/use-canvas-coordinator';
import { formatNumber } from '@/components/organisms/common/DocumentListing';
import { GoArrowRight } from 'react-icons/go';
import SimulationGrid from '@/components/molecules/trajectory/SimulationGrid';
import useTeamStore from '@/stores/team/team';
import Container from '@/components/primitives/Container';
import JobsHistoryViewer from '@/components/organisms/common/JobsHistoryViewer';
import ProcessingLoader from '@/components/atoms/common/ProcessingLoader';
import useAuthStore from '@/stores/authentication';
import useEnvironmentConfigStore from '@/stores/editor/environment-config';
import DashboardStats from '@/components/atoms/dashboard/DashboardStats';
import './Dashboard.css';
import Title from '@/components/primitives/Title';
import Paragraph from '@/components/primitives/Paragraph';

const getGreeting = (): string => {
    const hour = new Date().getHours();

    if (hour >= 5 && hour < 12) {
        return 'Good Morning';
    } else if (hour >= 12 && hour < 17) {
        return 'Good Afternoon';
    } else if (hour >= 17 && hour < 21) {
        return 'Good Evening';
    } else {
        return 'Good Night';
    }
};

const capitalize = (name?: string) => {
    if (!name) return '';
    const trimmed = String(name).trim();
    if (!trimmed) return '';
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
};

const DashboardPage: React.FC = memo(() => {
    const user = useAuthStore((state) => state.user);
    useTeamJobs();
    useTrajectoryUpdates();
    const trajectories = useTrajectoryStore((state) => state.trajectories);
    const isLoadingTrajectories = useTrajectoryStore((state) => state.isLoadingTrajectories);

    // Memoize the first trajectory ID to prevent unnecessary hook reruns
    const firstTrajectoryId = useMemo(() => trajectories?.[0]?._id ?? undefined, [trajectories?.[0]?._id]);

    const { trajectory, currentTimestep } = useCanvasCoordinator({ trajectoryId: firstTrajectoryId });
    const scene3DRef = useRef<Scene3DRef>(null)
    const selectedTeam = useTeamStore((state) => state.selectedTeam);

    // Check if there are any trajectories being processed(not completed)
    const isProcessing = useMemo(() => trajectories.some(t => t.status !== 'completed'), [trajectories]);
    const completedTrajectories = useMemo(() => trajectories.filter(t => t.status === 'completed'), [trajectories]);
    const lastCompletedTrajectory = completedTrajectories[0]; // Get most recent completed

    // When processing, show last completed trajectory. Otherwise show first trajectory
    const displayTrajectory = useMemo(() => isProcessing && lastCompletedTrajectory ? lastCompletedTrajectory : trajectories[0], [isProcessing, lastCompletedTrajectory, trajectories]);

    const hasNoTrajectories = !isLoadingTrajectories && trajectories.length === 0;

    const setBackgroundColor = useEnvironmentConfigStore((state) => state.setBackgroundColor);

    const [isLight, setIsLight] = useState(() =>
        typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'light'
    );

    // Update background color in environment config when theme changes
    useEffect(() => {
        if (typeof document === 'undefined') return;
        const root = document.documentElement;
        const update = () => {
            const isLightTheme = root.getAttribute('data-theme') === 'light';
            setIsLight(isLightTheme);
            setBackgroundColor(isLightTheme ? '#f8f8f8' : '#1E1E1E');
        };
        update();
        const observer = new MutationObserver(update);
        observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
        return () => observer.disconnect();
    }, [setBackgroundColor]);

    return (
        <FileUpload>
            <DashboardContainer className='d-flex h-max sm:column w-max gap-2 p-1   '>
                <Container className='d-flex column dashboard-body-left-container gap-2 h-max'>
                    <Container className='scene-preview-container p-relative w-max vh-max overflow-hidden'>
                        {isProcessing ? (
                            <Container style={{ position: 'absolute', top: '16px', left: '16px', zIndex: 20, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <ProcessingLoader
                                    className='scene-preview-processing'
                                    message="Your trajectory is being processed"
                                    completionRate={0}
                                    isVisible={true}
                                />
                            </Container>
                        ) : (trajectory?._id && currentTimestep !== undefined) && (
                            <>
                                <Container className='badge-container scene-preview-name-badge primary-surface p-absolute'>
                                    <Paragraph className='font-size-2 font-weight-5'>{trajectory.name}</Paragraph>
                                </Container>

                                <Container className='badge-container scene-preview-natoms-badge primary-surface p-absolute'>
                                    <Paragraph className='font-size-2 font-weight-5'>
                                        {formatNumber((trajectory.frames || []).find((f: any) => f.timestep === currentTimestep)?.natoms ?? 0)} atoms
                                    </Paragraph>
                                </Container>

                                <Container className='badge-container scene-preview-navigate-icon primary-surface p-absolute font-size-5'>
                                    <GoArrowRight />
                                </Container>
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

                        {isProcessing && (
                            <div
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    bottom: 0,
                                    backgroundColor: 'rgba(0, 0, 0, 0.3)',
                                    backdropFilter: 'blur(4px)',
                                    zIndex: 5,
                                    borderRadius: '0.75rem',
                                    pointerEvents: 'none'
                                }}
                            />
                        )}

                        <Container style={{ position: 'relative', zIndex: isProcessing ? 20 : 10 }}>
                            <JobsHistoryViewer />
                        </Container>

                        {hasNoTrajectories && (
                            <Container className='d-flex flex-center dashboard-canvas-overlay p-absolute inset-0'>
                                <Container className='d-flex column gap-05 text-center'>
                                    <Title className='font-size-5 color-primary font-weight-6'>Preview</Title>
                                    <Paragraph className='color-secondary font-size-3 line-height-5 dashboard-overlay-description'>Real-time visualization of atomic structures from your trajectory data will appear here once loaded.</Paragraph>
                                </Container>
                            </Container>
                        )}
                    </Container>
                </Container>

                <Container className='d-flex column dashboard-body-right-container gap-2'>
                    <Container className='dashboard-stats-wrapper p-relative w-max'>
                        <DashboardStats teamId={selectedTeam?._id} trajectoryId={displayTrajectory?._id} />
                    </Container>

                    <SimulationGrid />
                </Container>

            </DashboardContainer>
        </FileUpload>
    );
});

DashboardPage.displayName = 'DashboardPage';

export default DashboardPage;
