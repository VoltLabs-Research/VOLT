import { useEffect, useState } from 'react';
import { getTimesteps } from '../services/api';
import type { FileInfo } from '../types';

const useTimestepManager = (fileInfo: FileInfo | null) => {
    const [timesteps, setTimesteps] = useState<number[]>([]);
    const [currentTimestep, setCurrentTimestep] = useState<number>(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [playSpeed, setPlaySpeed] = useState(1.0);

    useEffect(() => {
        const loadTimesteps = async () => {
            if (!fileInfo) {
                setTimesteps([]);
                setCurrentTimestep(0);
                return;
            }
            
            try {
                console.log('Loading timesteps for file:', fileInfo.file_id);
                const data = await getTimesteps(fileInfo.file_id);
                console.log('Loaded timesteps:', data.timesteps);
                
                setTimesteps(data.timesteps);
                if (data.timesteps.length > 0) {
                    setCurrentTimestep(data.timesteps[0]);
                }
            } catch (err) {
                console.error('Error loading timesteps:', err);
                setTimesteps([]);
                setCurrentTimestep(0);
            }
        };

        loadTimesteps();
    }, [fileInfo?.file_id]);

    const handlePlayPause = () => {
        setIsPlaying(!isPlaying);
    };

    const handleTimestepChange = (timestep: number) => {
        setCurrentTimestep(timestep);
        setIsPlaying(false);
    };

    const handleSpeedChange = (speed: number) => {
        setPlaySpeed(speed);
    };

    return {
        timesteps,
        currentTimestep,
        isPlaying,
        playSpeed,
        handleTimestepChange,
        handlePlayPause,
        handleSpeedChange
    };
};

export default useTimestepManager;