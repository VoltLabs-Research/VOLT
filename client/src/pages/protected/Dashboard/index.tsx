import DashboardContainer from '@/components/atoms/DashboardContainer';
import SimulationGrid from '@/components/molecules/SimulationGrid';
import FileUpload from '@/components/molecules/FileUpload';
import useTeamJobs from '@/hooks/useTeamJobs';
import JobsHistory from '@/components/molecules/JobsHistory';
import './Dashboard.css';

const DashboardPage = () => {
    useTeamJobs();
    
    return (
        <FileUpload>
            <JobsHistory />

            <DashboardContainer pageName='Dashboard'>
                <SimulationGrid />
            </DashboardContainer>
        </FileUpload>
    );
};

export default DashboardPage;