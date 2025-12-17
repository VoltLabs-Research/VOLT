import React from 'react';
import type { PlaybackControlsProps } from '@/types/raster';
import { IoPauseOutline, IoPlayOutline } from 'react-icons/io5';

const PlaybackControls: React.FC<PlaybackControlsProps> = ({ isPlaying, onPlayPause }) => {
    return(
        <div className='raster-view-trajectory-playback-container font-size-5'>
            {isPlaying ? (
                <IoPauseOutline onClick={onPlayPause} className='raster-view-trajectory-play-icon font-size-5-5 color-primary cursor-pointer' />
            ) : (
                <IoPlayOutline onClick={onPlayPause} className='raster-view-trajectory-play-icon font-size-5-5 color-primary cursor-pointer' />
            )}
        </div>
    );
};

export default PlaybackControls;
