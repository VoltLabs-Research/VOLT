import { useEffect } from 'react';
import useTeamJobs from '@/hooks/useTeamJobs';
import UseAnimations from 'react-useanimations';
import activity from 'react-useanimations/lib/activity';
import { Box, Skeleton, Stack } from '@mui/material';
import { 
    FaCheck, 
    FaClock, 
    FaExclamationTriangle, 
    FaTimes,
    FaRedo
} from 'react-icons/fa';
import './JobsHistory.css';


const JobSkeleton: React.FC = () => (
    <Box
        sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            py: 1.5,
            px: 0,
        }}
    >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
            <Skeleton 
                variant="circular" 
                width={30} 
                height={30}
                sx={{ flexShrink: 0 }}
            />
            
            <Box sx={{ flex: 1, minWidth: 0 }}>
                <Skeleton 
                    variant="text" 
                    width="70%" 
                    height={20}
                    sx={{ mb: 0.5 }}
                />
                <Skeleton 
                    variant="text" 
                    width="100px" 
                    height={16}
                />
            </Box>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
            <Skeleton 
                variant="rounded" 
                width={60} 
                height={18}
                sx={{ borderRadius: '12px' }}
            />
        </Box>
    </Box>
);

const JobsHistory = () => {
    const { jobs, isConnected } = useTeamJobs();

    const statusConfig = {
        'completed': {
            icon: <FaCheck />,
        },
        'running': {
            icon: <UseAnimations animation={activity} />,
        },
        'queued': {
            icon: <FaClock />,
        },
        'retrying': {
            icon: <FaRedo />,
        },
        'queued_after_failure': {
            icon: <FaExclamationTriangle />,
        },
        'failed': {
            icon: <FaTimes />,
        },
        'unknown': {
            icon: <FaExclamationTriangle />,
        }
    };

    const getStatusConfig = (status) => {
        return statusConfig[status] || statusConfig['unknown'];
    };

    useEffect(() => {
        console.log(jobs);
    }, [jobs]);

    return (
        <div className='jobs-history-container'>
            {(!isConnected || jobs.length === 0) ? (
                <Stack spacing={0}>
                    {Array.from({ length: 6 }, (_, index) => (
                        <JobSkeleton key={index} />
                    ))}
                </Stack>
            ) : (
                jobs.map((job, index) => {
                    const config = getStatusConfig(job.status);
                    const IconComponent = config.icon;
                    
                    return (
                        <div className={'job-container '.concat(job.status)} key={index}>
                            <div className='job-left-container'>
                                <i className='job-icon-container'>
                                    {IconComponent}
                                </i>
                                <div className='job-info-container'>
                                    <h3 className='job-name'>
                                        {job.name}
                                        {(job?.chunkIndex !== undefined && job?.totalChunks !== undefined) && (
                                            <span> - Chunk {job.chunkIndex + 1}/{job.totalChunks}</span>
                                        )}
                                    </h3>
                                    <p className='job-message'>
                                        {job.message || job.status}
                                    </p>
                                </div>
                            </div>

                            <div className='job-status-info'>
                                <span className='job-status-badge'>
                                    {job.status}
                                </span>
                                {/*<p className='job-timestamp'>{formatTimeAgo(job.timestamp)}</p>*/}
                            </div>
                        </div>
                    );
                })
            )}
        </div> 
    );
};

export default JobsHistory;