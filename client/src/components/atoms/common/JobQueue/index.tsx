/**
 * Copyright(c) 2025, The Volterra Authors. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files(the "Software"), to deal
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
 */

import UseAnimations from 'react-useanimations';
import activity from 'react-useanimations/lib/activity';
import { FaCheck, FaClock, FaExclamationTriangle, FaTimes, FaRedo } from 'react-icons/fa';
import type { Job } from '@/types/jobs';
import './JobQueue.css';

const JobQueue = ({ job }: { job: Job }) => {
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

    if(!(job.status in statusConfig)) return;

    const IconComponent = statusConfig[job.status].icon;

    return(
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
                {(job.progress !== undefined && job.progress > 0 && job.status === 'running') && (
                    <span className='job-progress'>
                        {job.progress}%
                    </span>
                )}
                <span className='job-status-badge'>
                    {job.status}
                </span>
                {/*<p className='job-timestamp'>{formatTimeAgo(job.timestamp)}</p>*/}
            </div>
        </div>
    );
};

export default JobQueue;
