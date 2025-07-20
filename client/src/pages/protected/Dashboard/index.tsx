import DashboardContainer from '../../../components/atoms/DashboardContainer';
import SimulationGrid from '../../../components/molecules/SimulationGrid';
import FileUpload from '@/components/molecules/FileUpload';
import './Dashboard.css';

const DashboardPage = () => {
    return (
        <FileUpload>
            <DashboardContainer pageName='Dashboard'>
                <SimulationGrid />
            </DashboardContainer>
        </FileUpload>
    );
};

export default DashboardPage;