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
                <div className='dashboard-main-container'>
                    <TrajectoryPreview />

                    <div className='jobs-history-viewer'>
                        <div className='jobs-history-viewer-header'>
                            <h3 className='jobs-history-title'>Team's Jobs History</h3>
                        </div>

                        <div className='jobs-history-viewer-body'>
                            <JobsHistory />
                        </div>
                    </div>
                </div>

                {/*
                    <SimulationGrid />
                    <JobsHistory />
                */}
            </DashboardContainer>
        </FileUpload>
    );
};

export default DashboardPage;