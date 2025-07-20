import React from 'react';
import PlayControls from '../../molecules/PlayControls';
import TimestepSlider from '../../molecules/TimestepSlider';
import SpeedControl from '../../molecules/SpeedControl';
import EditorWidget from '../EditorWidget';
import useEditorStore from '../../../stores/editor';
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