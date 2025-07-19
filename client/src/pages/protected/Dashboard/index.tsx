import DashboardContainer from '../../../components/atoms/DashboardContainer';
import SimulationGrid from '../../../components/molecules/SimulationGrid';
import './Dashboard.css';

const DashboardPage = () => {

    return (
        <DashboardContainer pageName='Dashboard'>
            <SimulationGrid />
        </DashboardContainer>
    );
};

export default DashboardPage;