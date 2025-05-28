import React from 'react';
import { CiPlay1, CiPause1 } from "react-icons/ci";
import type { FileInfo } from '../types';
import EditorWidget from './EditorWidget';

interface TimestepControlsProps {
    fileInfo: FileInfo | null;
    timesteps: number[];
    currentTimestep: number;
    onTimestepChange: (timestep: number) => void;
    isPlaying: boolean;
    onPlayPause: () => void;
    playSpeed: number;
    onSpeedChange: (speed: number) => void;
    isConnected: boolean;
    isStreaming: boolean;
    streamProgress?: { current: number; total: number } | null;
    onStartPreloading: () => void;
    onStopPreloading: () => void;
    preloadedCount: number;
}

const TimestepControls: React.FC<TimestepControlsProps> = ({ 
    fileInfo, 
    timesteps, 
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
    if (!fileInfo || timesteps.length === 0) return null;

    const currentIndex = timesteps.indexOf(currentTimestep);
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
                        max={timesteps.length - 1}
                        value={currentIndex}
                        onChange={(e) => onTimestepChange(timesteps[parseInt(e.target.value)])}
                        className='editor-timestep-controls-slider'
                        disabled={!isConnected}
                        style={{
                            '--progress': `${(currentIndex / (timesteps.length - 1)) * 100}%`
                        }}
                    />
                    {currentTimestep} / {timesteps[timesteps.length - 1]}
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
                            '--progress': `${playSpeed / (2) * 100}%`
                        }}
                    />
                    {playSpeed.toFixed(1)}x
                </label>
            </div>
        </EditorWidget>
    );
};

export default TimestepControls;