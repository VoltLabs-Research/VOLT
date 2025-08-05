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

import React, { memo } from 'react';
import DashboardContainer from '@/components/atoms/DashboardContainer';
import SimulationGrid from '@/components/molecules/SimulationGrid';
import FileUpload from '@/components/molecules/FileUpload';
import JobsHistory from '@/components/molecules/JobsHistory';
import TrajectoryPreview from '@/components/molecules/TrajectoryPreview';
import AIPromptBox from '@/components/atoms/AIPromptBox';
import useTeamJobs from '@/hooks/jobs/use-team-jobs';
import './Dashboard.css';

const DashboardPage = memo(() => {
    // Initialize team jobs connection
    useTeamJobs();
    
    return (
        <FileUpload>            
            <DashboardContainer pageName='Dashboard' className='dashboard-wrapper-container'>
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

                <SimulationGrid />
            </DashboardContainer>

            <AIPromptBox />
        </FileUpload>
    );
});

DashboardPage.displayName = 'DashboardPage';

export default DashboardPage;