import React from 'react';
import PlayControls from '../../molecules/PlayControls';
import TimestepSlider from '../../molecules/TimestepSlider';
import SpeedControl from '../../molecules/SpeedControl';
import EditorWidget from '../EditorWidget';
import './TimestepControls.css';

interface TimestepControlsProps {
    folderInfo: {
        folderId: string;
        timesteps: number;
        min_timestep: number;
        max_timestep: number;
    };
    currentTimestep: number;
    onTimestepChange: (newTimestep: number) => void;
    isPlaying: boolean;
    onPlayPause: () => void;
    playSpeed: number;
    onSpeedChange: (newSpeed: number) => void;
    isConnected: boolean;
    isStreaming: boolean;
    streamProgress: { current: number; total: number };
}

const TimestepControls: React.FC<TimestepControlsProps> = ({
    folderInfo,
    currentTimestep,
    onTimestepChange,
    isPlaying,
    onPlayPause,
    playSpeed,
    onSpeedChange,
    isConnected
}) => {
    const { min_timestep, max_timestep } = folderInfo;

    return (
        <EditorWidget className='editor-timestep-controls'>
            <PlayControls
                isPlaying={isPlaying}
                onPlayPause={onPlayPause}
                disabled={!isConnected}
            />
            
            <TimestepSlider
                currentTimestep={currentTimestep}
                minTimestep={min_timestep}
                maxTimestep={max_timestep}
                onTimestepChange={onTimestepChange}
                disabled={!isConnected}
            />
            
            <SpeedControl
                playSpeed={playSpeed}
                onSpeedChange={onSpeedChange}
                disabled={!isConnected}
            />
        </EditorWidget>
    );
};

export default TimestepControls;