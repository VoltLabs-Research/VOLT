
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
        minTimestep: number;
        maxTimestep: number;
        availableTimesteps: number[];
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
    return (
        <EditorWidget className='editor-timestep-controls'>
            <PlayControls
                isPlaying={isPlaying}
                onPlayPause={onPlayPause}
            />
            
            <TimestepSlider
                currentTimestep={currentTimestep}
                availableTimesteps={folderInfo.availableTimesteps}
                onTimestepChange={onTimestepChange}
                disabled={!isConnected}
            />
            
            <SpeedControl
                playSpeed={playSpeed}
                onSpeedChange={onSpeedChange}
            />
        </EditorWidget>
    );
};

export default TimestepControls;
