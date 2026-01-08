/**
 * Copyright(c) 2025, The Volterra Authors. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files(the "Software"), to deal
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

