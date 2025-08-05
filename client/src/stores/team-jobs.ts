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
import io, { Socket } from 'socket.io-client';

const SOCKET_URL = 'http://172.20.10.5:8000/';

interface Job {
    jobId: string;
    trajectoryId: string;
    sessionId?: string;
    status: 'queued' | 'running' | 'completed' | 'failed' | 'retrying' | 'unknown';
    timestamp: string;
    [key: string]: any;
}

interface JobStats {
    total: number;
    completed: number;
    totalAllTime: number;
    byStatus: Record<string, number>;
    hasActiveJobs: boolean;
    completionRate: number;
    isActiveSession: boolean;
}

interface JobsByStatus {
    [status: string]: Job[];
    _stats?: JobStats;
}

interface TeamJobsState {
    // State
    jobs: Job[];
    isConnected: boolean;
    isLoading: boolean;
    expiredSessions: Set<string>;
    currentTeamId: string | null;
    socket: Socket | null;
    
    // Actions
    subscribeToTeam: (teamId: string, previousTeamId?: string | null) => void;
    disconnect: () => void;
    hasJobForTrajectory: (trajectoryId: string) => boolean;
    getJobsForTrajectory: (trajectoryId: string) => JobsByStatus;
    
    // Internal actions
    _initializeSocket: () => void;
    _handleConnect: () => void;
    _handleDisconnect: () => void;
    _handleTeamJobs: (initialJobs: Job[]) => void;
    _handleJobUpdate: (updatedJob: any) => void;
    _sortJobsByTimestamp: (jobsArray: Job[]) => Job[];
}

const useTeamJobsStore = create<TeamJobsState>()((set, get) => {
    const store = {
        // Initial state
        jobs: [],
        isConnected: false,
        isLoading: true,
        expiredSessions: new Set<string>(),
        currentTeamId: null,
        socket: null,

        // Internal helper methods
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

        _handleConnect: () => {
            console.log('Socket.IO connected successfully.');
            set({ isConnected: true });
            
            const { currentTeamId, socket } = get();
            if(currentTeamId && socket) {
                socket.emit('subscribe_to_team', {
                    teamId: currentTeamId,
                    previousTeamId: null,
                });
            }
        },

        _handleDisconnect: () => {
            console.log('Socket.IO disconnected.');
            set({ isConnected: false });
        },

        _handleTeamJobs: (initialJobs: Job[]) => {
            const { currentTeamId, _sortJobsByTimestamp } = get();
            console.log(`[${currentTeamId}] Received initial list of ${initialJobs.length} jobs:`, initialJobs);
            
            const sortedJobs = _sortJobsByTimestamp(initialJobs);
            set({ 
                jobs: sortedJobs, 
                isLoading: false 
            });
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
                newJobs = jobs.map((job) => 
                    job.jobId === updatedJob.jobId ? { ...job, ...updatedJob } : job
                );
            }else{
                console.log(`Adding new job ${updatedJob.jobId}`);
                newJobs = [...jobs, updatedJob];
            }
            
            const sortedJobs = _sortJobsByTimestamp(newJobs);
            set({ jobs: sortedJobs });
        },

        _initializeSocket: () => {
            const { socket } = get();
            
            // Don't create multiple socket instances
            if(socket) return;

            console.log('Initializing socket connection...');
            
            const newSocket = io(SOCKET_URL, {
                autoConnect: false
            });

            const { _handleConnect, _handleDisconnect, _handleTeamJobs, _handleJobUpdate } = get();

            // Setup event listeners
            newSocket.on('connect', _handleConnect);
            newSocket.on('disconnect', _handleDisconnect);
            newSocket.on('team_jobs', _handleTeamJobs);
            newSocket.on('job_update', _handleJobUpdate);

            set({ socket: newSocket });
        },

        // Public actions
        subscribeToTeam: (teamId: string, previousTeamId: string | null = null) => {
            const { socket, currentTeamId, _initializeSocket } = get();
            
            // Don't resubscribe to the same team
            if(currentTeamId === teamId){
                console.log(`Already subscribed to team ${teamId}`);
                return;
            }

            console.log(`Subscribing to team: ${teamId}`);
            
            // Initialize socket if not exists
            if(!socket){
                _initializeSocket();
            }

            // Reset state for new team
            set({ 
                currentTeamId: teamId,
                jobs: [],
                expiredSessions: new Set(),
                isLoading: true
            });

            const currentSocket = get().socket;
            if (!currentSocket) {
                console.error('Socket not initialized');
                return;
            }
            
            if (!currentSocket.connected) {
                currentSocket.connect();
            }

            currentSocket.emit('subscribe_to_team', {
                teamId: teamId,
                previousTeamId: previousTeamId || currentTeamId,
            });
        },

        disconnect: () => {
            const { socket } = get();
            
            if(socket){
                console.log('Disconnecting socket...');
                socket.disconnect();
                set({ 
                    socket: null,
                    isConnected: false,
                    currentTeamId: null,
                    jobs: [],
                    expiredSessions: new Set(),
                    isLoading: true
                });
            }
        },

        hasJobForTrajectory: (trajectoryId: string) => {
            const { jobs } = get();
            return jobs.some((job) => job.trajectoryId === trajectoryId);
        },

        getJobsForTrajectory: (trajectoryId: string): JobsByStatus => {
            const { jobs, expiredSessions } = get();
            const trajectoryJobs = jobs.filter((job) => job.trajectoryId === trajectoryId);
            
            if (trajectoryJobs.length === 0) {
                return {};
            }
            
            const activeJobs = trajectoryJobs.filter((job) => {
                if (job.sessionId && expiredSessions.has(job.sessionId)) {
                    return false;
                }
                
                if (!job.sessionId) {
                    const now = new Date().getTime();
                    const fiveMinutesAgo = now - (5 * 60 * 1000);
                    
                    if (!job.timestamp) return false;
                    
                    const jobTime = new Date(job.timestamp).getTime();
                    return jobTime >= fiveMinutesAgo;
                }
                
                return true;
            });
            
            console.log(`Trajectory ${trajectoryId}: Total jobs: ${trajectoryJobs.length}, Active jobs: ${activeJobs.length}, Expired sessions: ${expiredSessions.size}`);
            
            if (activeJobs.length === 0) {
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
            
            Object.keys(jobsByStatus).forEach(status => {
                jobsByStatus[status].sort((a, b) => {
                    if (!a.timestamp && !b.timestamp) return 0;
                    if (!a.timestamp) return 1;
                    if (!b.timestamp) return -1;
                    
                    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
                });
            });
            
            const completedJobs = jobsByStatus.completed?.length || 0;
            const totalActiveJobs = activeJobs.length;
            const completionRate = totalActiveJobs > 0 ? Math.round((completedJobs / totalActiveJobs) * 100) : 0;
            
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
                hasActiveJobs: activeJobs.some(job => ['running', 'queued', 'retrying'].includes(job.status)),
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