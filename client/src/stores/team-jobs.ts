/**
Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
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
import type { Job, JobsByStatus } from '@/types/jobs';

interface TeamJobsState {
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
    _getCurrentActiveSession: (trajectoryJobs: Job[], expiredSessions: Set<string>) => string | null;

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
    const logger = new Logger('use-team-job-store');
    
    let connectionUnsubscribe: (() => void) | null = null;
    let teamJobsUnsubscribe: (() => void) | null = null;
    let jobUpdateUnsubscribe: (() => void) | null = null;

    const store = {
        ...initialState,

        _sortJobsByTimestamp: (jobsArray: Job[]) => {
            return [...jobsArray].sort((a, b) => {
                if (!a.timestamp && !b.timestamp) return 0;
                if (!a.timestamp) return 1;
                if (!b.timestamp) return -1;
                
                const timestampA = new Date(a.timestamp);
                const timestampB = new Date(b.timestamp);
                
                return timestampB.getTime() - timestampA.getTime();
            });
        },

        _handleConnect: (connected: boolean) => {
            logger.log('Socket connection status:', connected);
            set({ isConnected: connected });

            if (connected) {
                const { currentTeamId } = get();
                if (currentTeamId) {
                    logger.log('Reconnected, re-subscribing to team:', currentTeamId);
                    socketService.subscribeToTeam(currentTeamId);
                }
            }
        },

        _handleTeamJobs: (initialJobs: Job[]) => {
            const { currentTeamId, _sortJobsByTimestamp } = get();
            logger.log(`[${currentTeamId}] Received initial list of ${initialJobs.length} jobs:`, initialJobs);

            const sortedJobs = _sortJobsByTimestamp(initialJobs);
            set({ jobs: sortedJobs, isLoading: false });
        },

        _handleJobUpdate: (updatedJob: any) => {
            const { currentTeamId, jobs, expiredSessions, _sortJobsByTimestamp } = get();

            if (updatedJob.type === 'session_expired') {
                logger.log(`Session ${updatedJob.sessionId} expired for trajectory ${updatedJob.trajectoryId}`);
                const newExpiredSessions = new Set(expiredSessions);
                newExpiredSessions.add(updatedJob.sessionId);
                set({ expiredSessions: newExpiredSessions });
                return;
            }

            logger.log(`[${currentTeamId}] Received job update:`, updatedJob);

            const jobExists = jobs.some((job) => job.jobId === updatedJob.jobId);
            let newJobs: Job[];

            if (jobExists) {
                logger.log(`Updating existing job ${updatedJob.jobId}`);
                newJobs = jobs.map((job) => job.jobId === updatedJob.jobId ? { ...job, ...updatedJob } : job);
            } else {
                logger.log(`Adding new job ${updatedJob.jobId}`);
                newJobs = [...jobs, updatedJob];
            }

            const sortedJobs = _sortJobsByTimestamp(newJobs);
            set({ jobs: sortedJobs });
        },

        _initializeSocket: () => {
            const { _handleConnect, _handleTeamJobs, _handleJobUpdate } = get();
            logger.log('Initializing socket listeners...');

            if (connectionUnsubscribe) connectionUnsubscribe();
            if (teamJobsUnsubscribe) teamJobsUnsubscribe();
            if (jobUpdateUnsubscribe) jobUpdateUnsubscribe();

            connectionUnsubscribe = socketService.onConnectionChange(_handleConnect);
            teamJobsUnsubscribe = socketService.on('team_jobs', _handleTeamJobs);
            jobUpdateUnsubscribe = socketService.on('job_update', _handleJobUpdate);

            if (!socketService.isConnected()) {
                socketService.connect()
                    .catch((error) => {
                        logger.error('Failed to connect socket:', error);
                        set({ isLoading: false });
                    });
            } else {
                set({ isConnected: true });
            }
        },

        subscribeToTeam: (teamId: string, previousTeamId: string | null = null) => {
            const { currentTeamId, _initializeSocket } = get();
            
            if (currentTeamId === teamId) {
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

            if (!socketService.isConnected()) {
                socketService.connect()
                    .then(() => {
                        socketService.subscribeToTeam(teamId, previousTeamId || currentTeamId!);
                    })
                    .catch((error) => {
                        logger.error('Failed to connect and subscribe', error);
                        set({ isLoading: false });
                    });
            } else {
                socketService.subscribeToTeam(teamId, previousTeamId || currentTeamId!);
            }
        },

        unsubscribeFromTeam: () => {
            const { currentTeamId } = get();
            if (currentTeamId) {
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
            if (connectionUnsubscribe) {
                connectionUnsubscribe();
                connectionUnsubscribe = null;
            }
            if (teamJobsUnsubscribe) {
                teamJobsUnsubscribe();
                teamJobsUnsubscribe = null;
            }
            if (jobUpdateUnsubscribe) {
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

        hasJobForTrajectory: (trajectoryId: string) => {
            const { jobs } = get();
            return jobs.some((job) => job.trajectoryId === trajectoryId);
        },

        _getCurrentActiveSession: (trajectoryJobs: Job[], expiredSessions: Set<string>) => {
            if (trajectoryJobs.length === 0) return null;

            const activeJobs = trajectoryJobs.filter(job => 
                ['running', 'queued', 'retrying'].includes(job.status) &&
                job.sessionId &&
                !expiredSessions.has(job.sessionId)
            );

            if (activeJobs.length === 0) return null;

            const sessionCounts = activeJobs.reduce((acc, job) => {
                if (job.sessionId) {
                    acc[job.sessionId] = (acc[job.sessionId] || 0) + 1;
                }
                return acc;
            }, {} as Record<string, number>);

            const mostActiveSession = Object.keys(sessionCounts).reduce((a, b) => 
                sessionCounts[a] > sessionCounts[b] ? a : b
            );

            logger.log(`Current active session for trajectory: ${mostActiveSession}`, {
                sessionCounts,
                expiredSessions: Array.from(expiredSessions)
            });

            return mostActiveSession;
        },

        getJobsForTrajectory: (trajectoryId: string): JobsByStatus => {
            const { jobs, expiredSessions, _getCurrentActiveSession, _sortJobsByTimestamp } = get();
            const trajectoryJobs = jobs.filter((job) => job.trajectoryId === trajectoryId);

            if (trajectoryJobs.length === 0) {
                return {};
            }

            const currentActiveSession = _getCurrentActiveSession(trajectoryJobs, expiredSessions);
            
            logger.log(`Processing trajectory ${trajectoryId}:`, {
                totalJobs: trajectoryJobs.length,
                currentActiveSession,
                expiredSessions: Array.from(expiredSessions)
            });

            let activeJobs: Job[] = [];

            if (currentActiveSession) {
                activeJobs = trajectoryJobs.filter((job) => 
                    job.sessionId === currentActiveSession
                );
                logger.log(`Using current session ${currentActiveSession}: ${activeJobs.length} jobs`);
            }

            if (activeJobs.length === 0 && trajectoryJobs.length > 0) {
                logger.log(`No active session found for ${trajectoryId}. Finding the most recent completed session.`);
                
                const sortedAllJobs = _sortJobsByTimestamp(trajectoryJobs);
                const mostRecentSessionId = sortedAllJobs[0]?.sessionId;

                if (mostRecentSessionId) {
                    logger.log(`Using most recent session ${mostRecentSessionId} as a fallback.`);
                    activeJobs = trajectoryJobs.filter(job => job.sessionId === mostRecentSessionId);
                } else {
                     logger.log(`Could not determine the most recent session for ${trajectoryId}.`);
                }
            }

            if (activeJobs.length === 0) {
                logger.log(`No active jobs found for trajectory ${trajectoryId}, and no previous session could be determined.`);
                return {};
            }

            const jobsByStatus = activeJobs.reduce((acc, job) => {
                const status = job.status || 'unknown';
                if (!acc[status]) {
                    acc[status] = [];
                }
                
                acc[status].push(job);
                return acc;
            }, {} as Record<string, Job[]>);

            Object.keys(jobsByStatus).forEach((status) => {
                jobsByStatus[status].sort((a, b) => {
                    if (!a.timestamp && !b.timestamp) return 0;
                    if (!a.timestamp) return 1;
                    if (!b.timestamp) return -1;

                    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
                });
            });

            const completedJobs = (jobsByStatus.completed?.length || 0) + (jobsByStatus.failed?.length || 0);
            const totalActiveJobs = activeJobs.length;
            const completionRate = totalActiveJobs > 0 ? Math.round((completedJobs / totalActiveJobs) * 100) : 0;

            const currentlyActiveJobs = activeJobs.filter((job) => ['running', 'queued', 'retrying'].includes(job.status));

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
                isActiveSession: !!currentActiveSession || totalActiveJobs > 0
            };

            logger.log(`Final stats for trajectory ${trajectoryId}:`, {
                session: currentActiveSession || activeJobs[0]?.sessionId,
                completed: completedJobs,
                total: totalActiveJobs,
                rate: completionRate,
                hasActive: currentlyActiveJobs.length > 0
            });

            return jobsByStatus;
        }
    };

    return store;
});

export default useTeamJobsStore;