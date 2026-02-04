import React from 'react';
import { CiPlay1, CiPause1 } from 'react-icons/ci';
import CanvasButton from '@/features/canvas/components/atoms/CanvasButton';
import Tooltip from '@/components/atoms/common/Tooltip';
import '@/features/canvas/components/molecules/PlayControls/PlayControls.css'

interface PlayControlsProps {
    isPlaying: boolean;
    onPlayPause: () => void;
    disabled?: boolean;
}

const PlayControls: React.FC<PlayControlsProps> = ({
    isPlaying,
    onPlayPause,
    disabled = false
}) => {
    return (
        <Tooltip content={isPlaying ? 'Pause' : 'Play'} placement="top">
            <CanvasButton
                onClick={onPlayPause}
                className='editor-timestep-controls-play-pause-button font-size-3 font-size-5 cursor-pointer'
                disabled={disabled}
                icon={isPlaying ? CiPause1 : CiPlay1}
            />
        </Tooltip>
    );
};

export default PlayControls;

