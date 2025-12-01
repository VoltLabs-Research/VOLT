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