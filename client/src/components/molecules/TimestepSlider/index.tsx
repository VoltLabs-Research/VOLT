import React from 'react';
import Slider from '../../atoms/Slider';
import './TimestepSlider.css';

interface TimestepSliderProps {
    currentTimestep: number;
    availableTimesteps: number[];
    onTimestepChange: (timestep: number) => void;
    disabled?: boolean;
}

const TimestepSlider: React.FC<TimestepSliderProps> = ({
    currentTimestep,
    availableTimesteps,
    onTimestepChange,
    disabled = false
}) => {
    const currentIndex = availableTimesteps.indexOf(currentTimestep);
    const safeCurrentIndex = currentIndex !== -1 ? currentIndex : 0;
    
    const minIndex = 0;
    const maxIndex = availableTimesteps.length - 1;

    const handleSliderChange = (index: number) => {
        const roundedIndex = Math.round(index);
        if (roundedIndex >= 0 && roundedIndex < availableTimesteps.length) {
            const selectedTimestep = availableTimesteps[roundedIndex];
            onTimestepChange(selectedTimestep);
        }
    };

    const progress = maxIndex > 0 ? (safeCurrentIndex / maxIndex) * 100 : 0;

    return (
        <div className='editor-timesteps-controls-slider'>
            <Slider
                min={minIndex}
                max={maxIndex}
                value={safeCurrentIndex}
                onChange={handleSliderChange}
                step={1}
                disabled={disabled}
                className='editor-timestep-controls-slider'
                style={{
                    '--progress': `${progress}%`
                } as React.CSSProperties}
            />
            <span className="timestep-display">
                {currentTimestep}
            </span>
        </div>
    );
};

export default TimestepSlider;
