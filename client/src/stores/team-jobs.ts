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

import { create } from 'zustand';
import { socketService } from '@/services/socketio';
import type { Job, JobsByStatus } from '@/types/jobs';

interface TeamJobsState{
    // State
    jobs: Job[];
    isConnected: boolean;
    isLoading: boolean;
    expiredSessions: Set<string>;
    currentTeamId: string | null;

    // Actions
    subscribeToTeam: (teamId: string, previousTeamId?: string | null) => void;
    unsubscribeFromTeam: () => void;
    disconnect: () => void;
    hasJobForTrajectory: (trajectoryId: string) => boolean;
    getJobsForTrajectory: (trajectoryId: string) => JobsByStatus;

    // Internal actions
    _initializeSocket: () => void;
    _handleConnect: (connected: boolean) => void;
    _handleTeamJobs: (initialJobs: Job[]) => void;
    _handleJobUpdate: (updatedJob: any) => void;
    _sortJobsByTimestamp: (jobsArray: Job[]) => Job[];
}

const initialState = {
    jobs: [],
    isConnected: false,
    isLoading: true,
    expiredSessions: new Set<string>(),
    currentTeamId: null
};

const useTeamJobsStore = create<TeamJobsState>()((set, get) => {
    let connectionUnsubscribe: (() => void) | null = null;
    let teamJobsUnsubscribe: (() => void) | null = null;
    let jobUpdateUnsubscribe: (() => void) | null = null;

    const store = {
        ...initialState,

        _sortJobsByTimestamp: (jobsArray: Job[]) => {
            return [...jobsArray].sort((a, b) => {
                if(!a.timestamp && !b.timestamp) return 0;
                if(!a.timestamp) return 1;
                if(!b.timestamp) return -1;
                
                const timestampA = new Date(a.timestamp);
                const timestampB = new Date(b.timestamp);
                
                return timestampB.getTime() - timestampA.getTime();
            });
        },

        _handleConnect: (connected: boolean) => {
            console.log('Socket connection status:', connected);
            set({ isConnected: connected });

            if(connected){
                const { currentTeamId } = get();
                if(currentTeamId){
                    console.log('Reconnected, re-subscribing to team:', currentTeamId);
                    socketService.subscribeToTeam(currentTeamId);
                }
            }
        },

        _handleTeamJobs: (initialJobs: Job[]) => {
            const { currentTeamId, _sortJobsByTimestamp } = get();
            console.log(`[${currentTeamId}] Received initial list of ${initialJobs.length} jobs:`, initialJobs);

            const sortedJobs = _sortJobsByTimestamp(initialJobs);
            set({ jobs: sortedJobs, isLoading: false });
        },

        _handleJobUpdate: (updatedJob: any) => {
            const { currentTeamId, jobs, expiredSessions, _sortJobsByTimestamp } = get();

            if(updatedJob.type === 'session_expired'){
                console.log(`Session ${updatedJob.sessionId} expired for trajectory ${updatedJob.trajectoryId}`);
                const newExpiredSessions = new Set(expiredSessions);
                newExpiredSessions.add(updatedJob.sessionId);
                set({ expiredSessions: newExpiredSessions });
                return;
            }

            console.log(`[${currentTeamId}] Received job update:`, updatedJob);

            const jobExists = jobs.some((job) => job.jobId === updatedJob.jobId);
            let newJobs: Job[];

            if(jobExists){
                console.log(`Updating existing job ${updatedJob.jobId}`);
                newJobs = jobs.map((job) => job.jobId === updatedJob.jobId ? { ...job, ...updatedJob } : job);
            }else{
                console.log(`Adding new job ${updatedJob.jobId}`);
                newJobs = [...jobs, updatedJob];
            }

            const sortedJobs = _sortJobsByTimestamp(newJobs);
            set({ jobs: sortedJobs });
        },

        _initializeSocket: () => {
            const { _handleConnect, _handleTeamJobs, _handleJobUpdate } = get();
            console.log('Initializing socket listeners...');

            // Cleanup existing listeners
            if(connectionUnsubscribe) connectionUnsubscribe();
            if(teamJobsUnsubscribe) teamJobsUnsubscribe();
            if(jobUpdateUnsubscribe) jobUpdateUnsubscribe();

            // Setup event listeners using socketService singleton
            connectionUnsubscribe = socketService.onConnectionChange(_handleConnect);
            teamJobsUnsubscribe = socketService.on('team_jobs', _handleTeamJobs);
            jobUpdateUnsubscribe = socketService.on('job_update', _handleJobUpdate);

            if(!socketService.isConnected()){
                socketService.connect()
                    .catch((error) => {
                        console.error('Failed to connect socket:', error);
                        set({ isLoading: false });
                    });
            }else{
                set({ isConnected: true });
            }
        },

        subscribeToTeam: (teamId: string, previousTeamId: string | null = null) => {
            const { currentTeamId, _initializeSocket } = get();
            
            // Don't resubscribe to the same team
            if(currentTeamId === teamId){
                console.log(`Already subscribed to team ${teamId}`);
                return;
            }

            console.log(`Subscribing to team: ${teamId}`);

            // Initialize socket listeners
            _initializeSocket();

            // Reset state for new team
            // TODO: can I use unsubscribeFromTeam to avoid duplicated code?
            set({
                currentTeamId: teamId,
                jobs: [],
                expiredSessions: new Set(),
                isLoading: true
            });

            // Connect and subcribe
            if(!socketService.isConnected()){
                socketService.connect()
                    .then(() => {
                        socketService.subscribeToTeam(teamId, previousTeamId || currentTeamId!);
                    })
                    .catch((error) => {
                        console.error('Failed to connect and subscribe', error);
                        set({ isLoading: false });
                    });
            }else{
                socketService.subscribeToTeam(teamId, previousTeamId || currentTeamId!);
            }
        },

        unsubscribeFromTeam: () => {
            const { currentTeamId } = get();
            if(currentTeamId){
                console.log(`Unsubscribing from team: ${currentTeamId}`);
                set({
                    currentTeamId: null,
                    jobs: [],
                    expiredSessions: new Set(),
                    isLoading: true
                });
            }
        },

        disconnect: () => {
            console.log('Disconnecting socket...');

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
            // TODO: duplicated code
            set({ 
                isConnected: false,
                currentTeamId: null,
                jobs: [],
                expiredSessions: new Set(),
                isLoading: true
            });
        },

        hasJobForTrajectory: (trajectoryId: string) => {
            const { jobs } = get();
            return jobs.some((job) => job.trajectoryId === trajectoryId);
        },

        getJobsForTrajectory: (trajectoryId: string): JobsByStatus => {
            const { jobs, expiredSessions } = get();
            const trajectoryJobs = jobs.filter((job) => job.trajectoryId === trajectoryId);

            if(trajectoryJobs.length === 0){
                return {};
            }

            // Determine active jobs
            // TODO: divide in smaller parts
            const now = new Date().getTime();
            const fiveMinuesAgo = now - (5 * 60 * 1000);

            const activeJobs = trajectoryJobs.filter((job) => {
                // If job status is completed or failed, always consider for the total progress
                if(job.status === 'completed' || job.status === 'failed'){
                    return true;
                }

                // If job status is running, retrying or queued, consider as active
                if(job.status === 'running' || job.status === 'queued' || job.status === 'retrying'){
                    // Filter by expired session if it has sessionId
                    if(job.sessionId && expiredSessions.has(job.sessionId)){
                        return false;
                    }
                    
                    return true;
                }

                // For jobs without sessionId, use time filter
                if(!job.sessionId){
                    if(!job.timestamp) return false;
                    const jobTime = new Date(job.timestamp).getTime();
                    return jobTime >= fiveMinuesAgo;
                }

                return true;
            });

            console.log(`Trajectory ${trajectoryId}: Total jobs: ${trajectoryJobs.length}, Active jobs: ${activeJobs.length}, Expired sessions: ${expiredSessions.size}`);
            if(activeJobs.length === 0){
                return {};
            }

            const jobsByStatus = activeJobs.reduce((acc, job) => {
                const status = job.status || 'unknown';
                if(!acc[status]){
                    acc[status] = [];
                }
                
                acc[status].push(job);
                return acc;
            }, {} as Record<string, Job[]>);

            Object.keys(jobsByStatus).forEach((status) => {
                jobsByStatus[status].sort((a, b) => {
                    if(!a.timestamp && !b.timestamp) return 0;
                    if(!a.timestamp) return 1;
                    if(!b.timestamp) return -1;

                    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
                });
            });

            // Calculate progress based on completed jobs vs active jobs
            const completedJobs = (jobsByStatus.completed?.length || 0) + (jobsByStatus.failed?.length || 0);
            const totalActiveJobs = activeJobs.length;
            const completionRate = totalActiveJobs > 0 ? Math.round((completedJobs / totalActiveJobs) * 100 ) : 0;

            // Active jobs are those that are running, queued or retrying
            const currentlyActiveJobs = activeJobs.filter((job) => ['running', 'queued', 'retrying'].includes(job.status));

            // Stats for useJobProgress hook
            jobsByStatus._stats = {
                total: totalActiveJobs,
                completed: completedJobs,
                totalAllTime: trajectoryJobs.length,
                byStatus: Object.keys(jobsByStatus).reduce((acc, status) => {
                    if (status !== '_stats') {
                        acc[status] = jobsByStatus[status].length;
                    }
                    return acc;
                }, {} as Record<string, number>),
                hasActiveJobs: currentlyActiveJobs.length > 0,
                completionRate: completionRate,
                isActiveSession: totalActiveJobs > 0
            };

            console.log(`Active session for trajectory ${trajectoryId}: ${completedJobs}/${totalActiveJobs} completed (${completionRate}%)`);
            return jobsByStatus;
        }
    };

    return store;
});

export default useTeamJobsStore;