import { usePageTitle } from '@/shared/presentation/hooks/use-page-title';
import DashboardStats from '@/modules/dashboard/presentation/components/atoms/DashboardStats';
import DashboardModelPreview from '@/modules/dashboard/presentation/components/molecules/DashboardModelPreview';
import SimulationGrid from '@/modules/trajectory/presentation/components/molecules/SimulationGrid';
import TrajectoryUploaderContainer from '@/modules/trajectory/presentation/components/organisms/TrajectoryUploaderContainer';
import { useTeamStore } from '@/modules/team/presentation/stores/use-team-store';
import Container from '@/shared/presentation/components/Container';
import '../../atoms/DashboardContainer/DashboardContainer.css';
import './Dashboard.css';

const DashboardPage = () => {
    usePageTitle('Dashboard');

    const selectedTeam = useTeamStore((state) => state.selectedTeam)!;
    const dashboardContainerClassName = 'd-flex h-max sm:column w-max gap-2 p-1';
    const dashboardContainerWrapperClassName = 'w-max flex-1 y-auto dashboard-container '.concat(
        `${dashboardContainerClassName}-wrapper`
    );

    return (
        <TrajectoryUploaderContainer>
            <Container className={dashboardContainerWrapperClassName}>
                <Container className={dashboardContainerClassName}>
                    <Container className='d-flex column dashboard-body-left-container gap-2 h-max'>
                        <Container className='scene-preview-container p-relative w-max vh-max overflow-hidden d-flex flex-center radius-md'>
                            <DashboardModelPreview />
                        </Container>
                    </Container>

                    <Container className='d-flex column dashboard-body-right-container gap-2'>
                        <Container className='dashboard-stats-wrapper p-relative w-max'>
                            <DashboardStats teamId={selectedTeam._id} />
                        </Container>

                        <SimulationGrid />
                    </Container>
                </Container>
            </Container>
        </TrajectoryUploaderContainer>
    );
};

export default DashboardPage;
