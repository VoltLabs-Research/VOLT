import UseAnimations from 'react-useanimations';
import activity from 'react-useanimations/lib/activity';
import { FaCheck, FaClock, FaExclamationTriangle, FaTimes, FaRedo } from 'react-icons/fa';
import './JobQueue.css';

const JobQueue = ({ job }) => {
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

    const config = statusConfig[job.status] || statusConfig['unknown'];
    const IconComponent = config.icon;

    return (
         <div className={'job-container '.concat(job.status)}>
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
};

export default JobQueue;