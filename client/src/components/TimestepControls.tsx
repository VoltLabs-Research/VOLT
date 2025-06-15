import React from 'react';
import { CiPlay1, CiPause1 } from "react-icons/ci";
import type { TimestepControlsProps } from '../types';
import EditorWidget from './EditorWidget';

type TimestepControlsProps = {
    folderInfo: {
        folder_id: string;
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
    preloadedCount?: number;
};

const TimestepControls: React.FC<TimestepControlsProps> = ({ 
    folderInfo,
    currentTimestep, 
    onTimestepChange, 
    isPlaying, 
    onPlayPause, 
    playSpeed, 
    onSpeedChange,
    isConnected,
    isStreaming,
    streamProgress,
    preloadedCount
}) => {
    const { min_timestep, max_timestep } = folderInfo;
    const currentIndex = currentTimestep - min_timestep;
    const maxIndex = max_timestep - min_timestep;

    const progressPercentage = streamProgress 
        ? (streamProgress.current / streamProgress.total) * 100 
        : 0;

    return (
        <EditorWidget className='editor-timestep-controls'>
            <button
                onClick={onPlayPause}
                className='editor-timestep-controls-play-pause-button'
                disabled={!isConnected}
            >
                {isPlaying ? <CiPause1 /> : <CiPlay1 />}   
            </button>

            <div className='editor-timesteps-controls-slider'>
                <label>
                    <input
                        type='range'
                        min={0}
                        max={maxIndex}
                        value={currentIndex}
                        onChange={(e) => onTimestepChange(min_timestep + parseInt(e.target.value))}
                        className='editor-timestep-controls-slider'
                        disabled={!isConnected}
                        style={{
                            '--progress': `${(currentIndex / maxIndex) * 100}%`
                        }}
                    />
                    {currentTimestep} / {max_timestep}
                </label>
            </div>

            <div className='editor-timesteps-controls-speed'>
                <label>
                    Speed:
                    <input
                        type='range'
                        min={0.1}
                        max={2}
                        step={0.1}
                        value={playSpeed}
                        onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
                        className='speed-slider'
                        disabled={!isConnected}
                        style={{
                            '--progress': `${playSpeed / 2 * 100}%`
                        }}
                    />
                    {playSpeed.toFixed(1)}x
                </label>
            </div>
        </EditorWidget>
    );
};

export default TimestepControls;