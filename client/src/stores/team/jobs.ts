/**
Copyright(C) Rodolfo Herrera Hernandez. All rights reserved.
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files(the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:
The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
**/
import { create } from 'zustand';
import { socketService } from '@/services/socketio';
import Logger from '@/services/logger';
import type { Job } from '@/types/jobs';
import { sortJobsByTimestamp } from '@/utilities/jobs';
import type { TeamJobsStore } from '@/types/stores/team/jobs';

const initialState = {
    jobs: [],
    isConnected: false,
    isLoading: true,
    expiredSessions: new Set<string>(),
    currentTeamId: null
};

const useTeamJobsStore = create<TeamJobsStore>()((set, get) => {
    const logger = new Logger('use-team-job-store');

    let connectionUnsubscribe: (() => void) | null = null;
    let teamJobsUnsubscribe: (() => void) | null = null;
    let jobUpdateUnsubscribe: (() => void) | null = null;

    return {
        ...initialState,

        _handleConnect: (connected: boolean) => {
            logger.log('Socket connection status:', connected);
            set({ isConnected: connected });

            if(!connected) return;

            const { currentTeamId } = get();
            if(currentTeamId){
                logger.log('Reconnected, re-subscribing to team:', currentTeamId);
                socketService.subscribeToTeam(currentTeamId);
            }
        },

        _handleTeamJobs: (initialJobs: Job[]) => {
            const { currentTeamId } = get();
            logger.log(`[${currentTeamId}] Received initial list of ${initialJobs.length} jobs:`, initialJobs);

            const sortedJobs = sortJobsByTimestamp(initialJobs);
            set({ jobs: sortedJobs, isLoading: false });
        },

        _handleJobUpdate: (updatedJob: any) => {
            const { currentTeamId, jobs, expiredSessions } = get();

            if(updatedJob.type === 'session_expired'){
                logger.log(`Session ${updatedJob.sessionId} expired for trajectory ${updatedJob.trajectoryId}`);
                const newExpiredSessions = new Set(expiredSessions);
                newExpiredSessions.add(updatedJob.sessionId);

                set({ expiredSessions: newExpiredSessions });
                return;
            }

            logger.log(`[${currentTeamId}] Received job update:`, updatedJob);

            const jobExists = jobs.some((job) => job.jobId === updatedJob.jobId);
            let newJobs: Job[];

            if(jobExists){
                logger.log(`Updating existing job ${updatedJob.jobId}`);
                newJobs = jobs.map((job) => job.jobId === updatedJob.jobId ? { ...job, ...updatedJob } : job);
            }else{
                logger.log(`Adding new job ${updatedJob.jobId}`);
                newJobs = [...jobs, updatedJob];
            }

            const sortedJobs = sortJobsByTimestamp(newJobs);
            set({ jobs: sortedJobs });
        },

        _initializeSocket: () => {
            const { _handleConnect, _handleTeamJobs, _handleJobUpdate } = get();
            logger.log('Initializing socket listeners...');

            if(connectionUnsubscribe) connectionUnsubscribe();
            if(teamJobsUnsubscribe) teamJobsUnsubscribe();
            if(jobUpdateUnsubscribe) jobUpdateUnsubscribe();

            connectionUnsubscribe = socketService.onConnectionChange(_handleConnect);
            teamJobsUnsubscribe = socketService.on('team_jobs', _handleTeamJobs);
            jobUpdateUnsubscribe = socketService.on('job_update', _handleJobUpdate);

            if(!socketService.isConnected()){
                socketService.connect()
                    .catch((error) => {
                        logger.error('Failed to connect socket:', error);
                        set({ isLoading: false });
                    });
            }else{
                set({ isConnected: true });
            }
        },

        subscribeToTeam: (teamId: string, previousTeamId: string | null = null) => {
            const { currentTeamId, _initializeSocket } = get();

            if(currentTeamId === teamId){
                logger.log(`Already subscribed to team ${teamId}`);
                return;
            }

            logger.log(`Subscribing to team: ${teamId}`);
            _initializeSocket();

            set({
                currentTeamId: teamId,
                jobs: [],
                expiredSessions: new Set(),
                isLoading: true
            });

            if(!socketService.isConnected()) {
                socketService.connect()
                    .then(() => {
                        socketService.subscribeToTeam(teamId, previousTeamId || currentTeamId!);
                    })
                        .catch((error) => {
                        logger.error('Failed to connect and subscribe', error);
                        set({ isLoading: false });
                    });
            }else{
                socketService.subscribeToTeam(teamId, previousTeamId || currentTeamId!);
            }
        },

        unsubscribeFromTeam: () => {
            const { currentTeamId } = get();
            if(currentTeamId){
                logger.log(`Unsubscribing from team: ${currentTeamId}`);
                set({
                    currentTeamId: null,
                    jobs: [],
                    expiredSessions: new Set(),
                    isLoading: true
                });
            }
        },

        disconnect: () => {
            logger.log('Disconnecting socket...');
            if(connectionUnsubscribe){
                connectionUnsubscribe();
                connectionUnsubscribe = null;
            }
            if(teamJobsUnsubscribe){
                teamJobsUnsubscribe();
                teamJobsUnsubscribe = null;
            }
            if(jobUpdateUnsubscribe){
                jobUpdateUnsubscribe();
                jobUpdateUnsubscribe = null;
            }
            socketService.disconnect();
            set({
                isConnected: false,
                currentTeamId: null,
                jobs: [],
                expiredSessions: new Set(),
                isLoading: true
            });
        },
    }
});

export default useTeamJobsStore;
