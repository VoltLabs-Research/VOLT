/**
* Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
*
* Permission is hereby granted, free of charge, to any person obtaining a copy
* of this software and associated documentation files (the "Software"), to deal
* in the Software without restriction, including without limitation the rights
* to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
* copies of the Software, and to permit persons to whom the Software is
* furnished to do so, subject to the following conditions:
*
* The above copyright notice and this permission notice shall be included in all
* copies or substantial portions of the Software.
*
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
* IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
* FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
* AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
* LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
* OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
* SOFTWARE.
**/

import { memo } from 'react';
import useTeamJobsStore from '@/stores/team/jobs';
import JobSkeleton from '@/components/atoms/common/JobSkeleton';
import JobQueue from '@/components/atoms/common/JobQueue';
import './JobsHistory.css';

const JobsHistory = memo(() => {
    const jobs = useTeamJobsStore((state) => state.jobs);
    const isConnected = useTeamJobsStore((state) => state.isConnected);
    const isLoading = useTeamJobsStore((state) => state.isLoading);

    const shouldShowSkeleton = !isConnected || isLoading;

    return (
        <div className='jobs-history-container'>
            {shouldShowSkeleton ? (
                <JobSkeleton />
            ) : (
                jobs.map((job, index) => (
                    <JobQueue 
                        job={job} 
                        key={job.jobId || `job-${index}`}
                    />
                ))
            )}
        </div> 
    );
});

JobsHistory.displayName = 'JobsHistory';

export default JobsHistory;