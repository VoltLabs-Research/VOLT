import React from 'react';
import Slider from '../../atoms/Slider';
import './SpeedControl.css'

interface SpeedControlProps {
    playSpeed: number;
    onSpeedChange: (speed: number) => void;
    disabled?: boolean;
}

const SpeedControl: React.FC<SpeedControlProps> = ({
    playSpeed,
    onSpeedChange,
    disabled = false
}) => {
    return (
        <div className='editor-timesteps-controls-speed'>
            Speed:
            <Slider
                min={0.1}
                max={2}
                value={playSpeed}
                onChange={onSpeedChange}
                step={0.1}
                disabled={disabled}
                className='speed-slider'
                style={{
                    '--progress': `${playSpeed / 2 * 100}%`
                } as React.CSSProperties}
            />
            {playSpeed.toFixed(1)}x
        </div>
    );
};

export default SpeedControl;