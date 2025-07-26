import { useState, useEffect, useRef} from 'react';
import useTeamStore from '@/stores/team';
import io from 'socket.io-client';

const SOCKET_URL = 'http://192.168.1.85:8000/';

export const socket = io(SOCKET_URL, {
    autoConnect: false
});

const useTeamJobs = () => {
    const selectedTeam = useTeamStore((state) => state.selectedTeam);
    const [jobs, setJobs] = useState([]);
    const [isConnected, setIsConnected] = useState(socket.connected);
    const previousTeamIdRef = useRef(null);

    useEffect(() => {
        const teamId = selectedTeam?._id;

        if(!teamId){
            setJobs([]);

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
            setJobs(initialJobs);
        };

        const handleJobUpdate = (updatedJob) => {
            console.log(`[${teamId}] Received job update:`, updatedJob);
            setJobs((prevJobs) => {
                const jobExists = prevJobs.some((job) => job.jobId === updatedJob.jobId);
                if(jobExists){
                    console.log(` Updating existing job ${updatedJob.jobId}`);
                    return prevJobs.map((job) => job.jobId === updatedJob.jobId ? { ...job, ...updatedJob } : job);
                }else{
                    console.log(`Adding new job ${updatedJob.jobId}`);
                    return [...prevJobs, updatedJob];
                }
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

    return { jobs, isConnected };
};

export default useTeamJobs;