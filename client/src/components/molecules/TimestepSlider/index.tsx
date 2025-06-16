import React from 'react';
import Slider from '../../atoms/Slider';
import './TimestepSlider.css';

interface TimestepSliderProps {
    currentTimestep: number;
    minTimestep: number;
    maxTimestep: number;
    onTimestepChange: (timestep: number) => void;
    disabled?: boolean;
}

const TimestepSlider: React.FC<TimestepSliderProps> = ({
    currentTimestep,
    minTimestep,
    maxTimestep,
    onTimestepChange,
    disabled = false
}) => {
    const currentIndex = currentTimestep - minTimestep;
    const maxIndex = maxTimestep - minTimestep;

    const handleSliderChange = (value: number) => {
        onTimestepChange(minTimestep + value);
    };

    return (
        <div className='editor-timesteps-controls-slider'>
            <Slider
                min={0}
                max={maxIndex}
                value={currentIndex}
                onChange={handleSliderChange}
                disabled={disabled}
                className='editor-timestep-controls-slider'
                style={{
                    '--progress': `${(currentIndex / maxIndex) * 100}%`
                } as React.CSSProperties}
            />
            {currentTimestep} / {maxTimestep}
        </div>
    );
};

export default TimestepSlider;