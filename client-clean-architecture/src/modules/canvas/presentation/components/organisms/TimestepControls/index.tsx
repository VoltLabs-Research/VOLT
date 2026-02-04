import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import PlayControls from '@/modules/canvas/presentation/components/molecules/PlayControls';
import TimestepSlider from '@/modules/canvas/presentation/components/molecules/TimestepSlider';
import SpeedControl from '@/modules/canvas/presentation/components/molecules/SpeedControl';
import EditorWidget from '@/modules/canvas/presentation/components/organisms/EditorWidget';
import Container from '@/shared/presentation/components/Container';
import { useEditorStore } from '@/modules/canvas/presentation/stores/editor';
import '@/modules/canvas/presentation/components/organisms/TimestepControls/TimestepControls.css';

const TimestepControls: React.FC = () => {
    const timestepData = useEditorStore((state) => state.timestepData);
    const currentTimestep = useEditorStore((state) => state.currentTimestep);
    const isPlaying = useEditorStore((state) => state.isPlaying);
    const playSpeed = useEditorStore((state) => state.playSpeed);
    const togglePlay = useEditorStore((state) => state.togglePlay);
    const setPlaySpeed = useEditorStore((state) => state.setPlaySpeed);
    const setCurrentTimestep = useEditorStore((state) => state.setCurrentTimestep);
    const isModelLoading = useEditorStore((state) => state.isModelLoading);

    if (currentTimestep === undefined) return null;

    return (
        <EditorWidget className='editor-timestep-controls p-1 row items-center content-between p-absolute' draggable={false}>
            <PlayControls
                isPlaying={isPlaying}
                onPlayPause={togglePlay}
            />

            <Container className='timestep-slider-wrapper p-relative flex-1'>
                <TimestepSlider
                    currentTimestep={currentTimestep}
                    maxTimestep={timestepData.maxTimestep}
                    availableTimesteps={timestepData.timesteps}
                    onTimestepChange={setCurrentTimestep}
                    disabled={false}
                />

                <AnimatePresence>
                    {isModelLoading && (
                        <motion.div
                            className='frame-loading-indicator p-absolute overflow-hidden'
                            initial={{ opacity: 0, scaleX: 0 }}
                            animate={{ opacity: 1, scaleX: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                        >
                            <div className='frame-loading-bar p-absolute inset-0' />
                        </motion.div>
                    )}
                </AnimatePresence>
            </Container>

            <SpeedControl
                playSpeed={playSpeed}
                onSpeedChange={setPlaySpeed}
            />
        </EditorWidget>
    );
};

export default TimestepControls;
