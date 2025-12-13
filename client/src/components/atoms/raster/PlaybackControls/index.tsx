import React from 'react';
import type { PlaybackControlsProps } from '@/types/raster';
import { IoPauseOutline, IoPlayOutline } from 'react-icons/io5';

const PlaybackControls: React.FC<PlaybackControlsProps> = ({ isPlaying, onPlayPause }) => {
    return(
        <div className='raster-view-trajectory-playback-container'>
            {isPlaying ? (
                <IoPauseOutline onClick={onPlayPause} className='raster-view-trajectory-play-icon' />
            ) : (
                <IoPlayOutline onClick={onPlayPause} className='raster-view-trajectory-play-icon' />
            )}
        </div>
    );
};

export default PlaybackControls;
