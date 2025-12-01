/**
 * Copyright (c) 2025, The Volterra Authors. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import React from 'react';
import Slider from '@/components/atoms/form/Slider';
import './TimestepSlider.css';

interface TimestepSliderProps {
    currentTimestep: number;
    availableTimesteps: number[];
    onTimestepChange: (timestep: number) => void;
    disabled?: boolean;
    maxTimestep: number;
}

const TimestepSlider: React.FC<TimestepSliderProps> = ({
    currentTimestep,
    availableTimesteps,
    onTimestepChange,
    maxTimestep,
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
                {currentTimestep} / {maxTimestep}
            </span>
        </div>
    );
};

export default TimestepSlider;
