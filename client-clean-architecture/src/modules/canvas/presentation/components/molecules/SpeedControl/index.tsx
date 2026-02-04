import React from 'react';
import Slider from '@/shared/presentation/components/Slider';
import '@/modules/canvas/presentation/components/molecules/SpeedControl/SpeedControl.css';

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
        <div className='d-flex items-center gap-05 editor-timesteps-controls-speed'>
            Speed:
            <Slider
                min={0.1}
                max={10}
                value={playSpeed}
                onChange={onSpeedChange}
                step={0.1}
                disabled={disabled}
                className='speed-slider'
                style={{
                    '--progress': `${(playSpeed / 10) * 100}%`
                } as React.CSSProperties}
            />
            {playSpeed.toFixed(1)}x
        </div>
    );
};

export default SpeedControl;
