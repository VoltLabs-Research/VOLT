import React, { memo } from 'react';
import { usePageTitle } from '@/shared/presentation/hooks/use-page-title';
import DashboardContainer from '@/modules/dashboard/presentation/components/atoms/DashboardContainer';
import DashboardStats from '@/modules/dashboard/presentation/components/atoms/DashboardStats';
import SimulationGrid from '@/modules/trajectory/presentation/components/molecules/SimulationGrid';
import TrajectoryUploaderContainer from '@/modules/trajectory/presentation/components/organisms/TrajectoryUploaderContainer';
import { useTeamStore } from '@/modules/team/presentation/stores/use-team-store';
import Container from '@/shared/presentation/components/Container';
import Title from '@/shared/presentation/components/Title';
import Paragraph from '@/shared/presentation/components/Paragraph';
import './Dashboard.css';

const DashboardPage: React.FC = memo(() => {
    usePageTitle('Dashboard');

    const selectedTeam = useTeamStore((state) => state.selectedTeam);

    return (
        <TrajectoryUploaderContainer>
            <DashboardContainer className='d-flex h-max sm:column w-max gap-2 p-1'>
                <Container className='d-flex column dashboard-body-left-container gap-2 h-max'>
                    <Container className='scene-preview-container p-relative w-max vh-max overflow-hidden d-flex flex-center'>
                        <Container className='d-flex flex-center dashboard-canvas-overlay p-absolute inset-0'>
                            <Container className='d-flex column gap-05 text-center'>
                                <Title className='font-size-5 color-primary font-weight-6'>Preview</Title>
                                <Paragraph className='color-secondary font-size-3 line-height-5 dashboard-overlay-description'>
                                    Real-time visualization of atomic structures from your trajectory data will appear here once loaded.
                                </Paragraph>
                            </Container>
                        </Container>
                    </Container>
                </Container>

                <Container className='d-flex column dashboard-body-right-container gap-2'>
                    <Container className='dashboard-stats-wrapper p-relative w-max'>
                        <DashboardStats teamId={selectedTeam?._id} />
                    </Container>

                    <SimulationGrid />
                </Container>
            </DashboardContainer>
        </TrajectoryUploaderContainer>
    );
});

DashboardPage.displayName = 'DashboardPage';

export default DashboardPage;
