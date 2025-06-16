import React from 'react';
import { CiPlay1, CiPause1 } from 'react-icons/ci';
import Button from '../../atoms/Button';

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
        <Button
            onClick={onPlayPause}
            className='editor-timestep-controls-play-pause-button'
            disabled={disabled}
            icon={isPlaying ? CiPause1 : CiPlay1}
        />
    );
};

export default PlayControls;