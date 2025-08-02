import DashboardContainer from '@/components/atoms/DashboardContainer';
import SimulationGrid from '@/components/molecules/SimulationGrid';
import FileUpload from '@/components/molecules/FileUpload';
import useTeamJobs from '@/hooks/useTeamJobs';
import JobsHistory from '@/components/molecules/JobsHistory';
import TrajectoryPreview from '@/components/molecules/TrajectoryPreview';
import './Dashboard.css';

const DashboardPage = () => {
    useTeamJobs();
    
    return (
        <FileUpload>            
            <DashboardContainer pageName='Dashboard'>
                <TrajectoryPreview />

                {/*
                    <SimulationGrid />
                    <JobsHistory />
                */}
            </DashboardContainer>
        </FileUpload>
    );
};

export default DashboardPage;