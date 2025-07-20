/**
* Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
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
**/

import React from 'react';
import PlayControls from '@/components/molecules/PlayControls';
import TimestepSlider from '@/components/molecules/TimestepSlider';
import SpeedControl from '@/components/molecules/SpeedControl';
import EditorWidget from '@/components/organisms/EditorWidget';
import useEditorStore from '@/stores/editor';
import './TimestepControls.css';

const TimestepControls: React.FC = () => {
    const currentTimestep = useEditorStore((state) => state.currentTimestep);
    const timestepData = useEditorStore((state) => state.timestepData);
    const setCurrentTimestep = useEditorStore(state => state.setCurrentTimestep);
    const isPlaying = useEditorStore((state) => state.isPlaying);
    const togglePlay = useEditorStore((state) => state.togglePlay);
    const playSpeed = useEditorStore((state) => state.playSpeed);
    const setPlaySpeed = useEditorStore((state) => state.setPlaySpeed);

    if(currentTimestep === undefined) return null;

    return (
        <EditorWidget className='editor-timestep-controls'>
            <PlayControls
                isPlaying={isPlaying}
                onPlayPause={togglePlay}
            />
            
            <TimestepSlider
                currentTimestep={currentTimestep}
                availableTimesteps={timestepData.timesteps}
                onTimestepChange={setCurrentTimestep}
                disabled={false}
            />
            
            <SpeedControl
                playSpeed={playSpeed}
                onSpeedChange={setPlaySpeed}
            />
        </EditorWidget>
    );
};

export default TimestepControls;