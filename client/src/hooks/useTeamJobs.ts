import { useState, useEffect, useRef} from 'react';
import useTeamStore from '@/stores/team';
import io from 'socket.io-client';

const SOCKET_URL = 'http://172.20.10.5:8000/';

export const socket = io(SOCKET_URL, {
    autoConnect: false
});

const useTeamJobs = () => {
    const selectedTeam = useTeamStore((state) => state.selectedTeam);
    const [jobs, setJobs] = useState([]);
    const [isConnected, setIsConnected] = useState(socket.connected);
    const [isLoading, setIsLoading] = useState(true);
    const [expiredSessions, setExpiredSessions] = useState(new Set());
    const previousTeamIdRef = useRef(null);

    const sortJobsByTimestamp = (jobsArray) => {
        return [...jobsArray].sort((a, b) => {
            if(!a.timestamp && !b.timestamp) return 0;
            if(!a.timestamp) return 1;
            if(!b.timestamp) return -1;
            
            const timestampA = new Date(a.timestamp);
            const timestampB = new Date(b.timestamp);
            
            return timestampB.getTime() - timestampA.getTime();
        });
    };

    const hasJobForTrajectory = (trajectoryId) => {
        return jobs.some((job) => job.trajectoryId === trajectoryId);
    };

    const getJobsForTrajectory = (trajectoryId) => {
        const trajectoryJobs = jobs.filter((job) => job.trajectoryId === trajectoryId);
        
        if(trajectoryJobs.length === 0){
            return {};
        }
        
        const activeJobs = trajectoryJobs.filter((job) => {
            if(job.sessionId && expiredSessions.has(job.sessionId)){
                return false;
            }
            
            if(!job.sessionId){
                const now = new Date().getTime();
                const fiveMinutesAgo = now - (5 * 60 * 1000);
                
                if(!job.timestamp) return false;
                
                const jobTime = new Date(job.timestamp).getTime();
                return jobTime >= fiveMinutesAgo;
            }
            
            return true;
        });
        
        console.log(`🔍 Trajectory ${trajectoryId}: Total jobs: ${trajectoryJobs.length}, Active jobs: ${activeJobs.length}, Expired sessions: ${expiredSessions.size}`);
        
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
        }, {});
        
        Object.keys(jobsByStatus).forEach(status => {
            jobsByStatus[status].sort((a, b) => {
                if(!a.timestamp && !b.timestamp) return 0;
                if(!a.timestamp) return 1;
                if(!b.timestamp) return -1;
                
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
                if(status !== '_stats'){
                    acc[status] = jobsByStatus[status].length;
                }
                return acc;
            }, {}),
            hasActiveJobs: activeJobs.some(job => ['running', 'queued', 'retrying'].includes(job.status)),
            completionRate: completionRate,
            isActiveSession: totalActiveJobs > 0
        };
        
        console.log(`Active session for trajectory ${trajectoryId}: ${completedJobs}/${totalActiveJobs} completed (${completionRate}%)`);
        
        return jobsByStatus;
    };

    useEffect(() => {
        const teamId = selectedTeam?._id;

        if(!teamId){
            setJobs([]);
            setExpiredSessions(new Set());

            if(socket.connected && previousTeamIdRef.current){
                socket.emit('subscribe_to_team', {
                    previousTeamId: previousTeamIdRef.current
                });
                previousTeamIdRef.current = null;
            }
            return;
        }
        
        if(!socket.connected){
            socket.connect();
        }

        const handleConnect = () => {
            console.log('Socket.IO connected successfully.');
            setIsConnected(true);
            socket.emit('subscribe_to_team', {
                teamId: teamId,
                previousTeamId: previousTeamIdRef.current,
            });
            previousTeamIdRef.current = teamId;
        };

        const handleDisconnect = () => {
            console.log('Socket.IO disconnected.');
            setIsConnected(false);
        };

        const handleTeamJobs = (initialJobs) => {
            console.log(`[${teamId}] Received initial list of ${initialJobs.length} jobs:`, initialJobs);
            const sortedJobs = sortJobsByTimestamp(initialJobs);
            setJobs(sortedJobs);
            setIsLoading(false);
        };

        const handleJobUpdate = (updatedJob) => {
            if (updatedJob.type === 'session_expired') {
                console.log(`🕐 Session ${updatedJob.sessionId} expired for trajectory ${updatedJob.trajectoryId}`);
                setExpiredSessions(prev => new Set([...prev, updatedJob.sessionId]));
                return;
            }

            console.log(`[${teamId}] Received job update:`, updatedJob);
            setJobs((prevJobs) => {
                const jobExists = prevJobs.some((job) => job.jobId === updatedJob.jobId);
                let newJobs;
                
                if(jobExists){
                    console.log(`Updating existing job ${updatedJob.jobId}`);
                    newJobs = prevJobs.map((job) => job.jobId === updatedJob.jobId ? { ...job, ...updatedJob } : job);
                }else{
                    console.log(`Adding new job ${updatedJob.jobId}`);
                    newJobs = [...prevJobs, updatedJob];
                }
                
                return sortJobsByTimestamp(newJobs);
            });
        };

        socket.on('connect', handleConnect);
        socket.on('disconnect', handleDisconnect);
        socket.on('team_jobs', handleTeamJobs);
        socket.on('job_update', handleJobUpdate);

        if(socket.connected){
            console.log(`[${teamId}] Socket already connected, subscribing to team...`);
            socket.emit('subscribe_to_team', {
                teamId: teamId,
                previousTeamId: previousTeamIdRef.current,
            });
            previousTeamIdRef.current = teamId;
        }

        return () => {
            console.log(`[${teamId}] Cleaning up listeners for team.`);
            socket.off('connect', handleConnect);
            socket.off('disconnect', handleDisconnect);
            socket.off('team_jobs', handleTeamJobs);
            socket.off('job_update', handleJobUpdate);
        };
    }, [selectedTeam]);

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