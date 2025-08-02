import React, { useMemo } from 'react';
import useTeamJobs from '@/hooks/useTeamJobs';
import './JobsHistory.css';

const JobsHistory = () => {
    const { jobs, isConnected } = useTeamJobs();

    const jobsByStatus = useMemo(() => {
        const latestJobs = jobs.reduce((acc, job) => {
            const existingJob = acc[job.jobId];
            if(!existingJob || new Date(job.updatedAt || job.createdAt) > new Date(existingJob.updatedAt || existingJob.createdAt)){
                acc[job.jobId] = job;
            }

            return acc;
        }, {});

        const grouped = Object.values(latestJobs).reduce((acc, job) => {
            const status = job.status || 'unknown';
            if(!acc[status]){
                acc[status] = [];
            }

            acc[status].push(job);
            return acc;
        }, {});

        Object.keys(grouped).forEach((status) => {
            grouped[status].sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
        });

        return grouped;
    }, [jobs]);

    const statusOrder = [
        'running', 
        'queued',
        'retrying',
        'queued_after_failure',
        'completed',
        'failed'
    ];
    const sortedStatuses = Object.keys(jobsByStatus).sort((a, b) => {
        const aIndex = statusOrder.indexOf(a);
        const bIndex = statusOrder.indexOf(b);
        return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
    });

    return isConnected && (
        <div className='jobs-history-container'>
            {jobs.map((job, index) => (
                <div className='job-container' key={index}>
                    <h3>{job.jobId}</h3>
                </div>
            ))}
        </div> 
    );
};

export default JobsHistory;