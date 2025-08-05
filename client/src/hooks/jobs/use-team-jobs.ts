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

import { useEffect, useRef } from 'react';
import useTeamStore from '@/stores/team';
import useTeamJobsStore from '@/stores/team-jobs';

const useTeamJobs = () => {
    const selectedTeam = useTeamStore((state) => state.selectedTeam);
    const previousTeamIdRef = useRef<string | null>(null);
    
    // Get state and actions from store
    const {
        jobs,
        isConnected,
        isLoading,
        expiredSessions,
        subscribeToTeam,
        hasJobForTrajectory,
        getJobsForTrajectory,
        _initializeSocket
    } = useTeamJobsStore();

    // Handle team changes
    useEffect(() => {
        const teamId = selectedTeam?._id;

        if (!teamId) {
            // Clear data when no team is selected
            previousTeamIdRef.current = null;
            return;
        }

        // Initialize socket on first mount
        _initializeSocket();
        
        // Subscribe to new team
        subscribeToTeam(teamId, previousTeamIdRef.current);
        previousTeamIdRef.current = teamId;

    }, [selectedTeam?._id, subscribeToTeam, _initializeSocket]);

    return {
        jobs,
        isConnected,
        isLoading,
        hasJobForTrajectory,
        getJobsForTrajectory,
        expiredSessions: expiredSessions.size
    };
};

export default useTeamJobs;