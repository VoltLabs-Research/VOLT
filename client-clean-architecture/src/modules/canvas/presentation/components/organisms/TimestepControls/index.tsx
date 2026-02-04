import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CiPlay1, CiPause1 } from 'react-icons/ci';
import Button from '@/shared/presentation/components/Button';
import Tooltip from '@/shared/presentation/components/Tooltip';
import Slider from '@/shared/presentation/components/Slider';
import WidgetContainer from '@/modules/canvas/presentation/components/atoms/WidgetContainer';
import Container from '@/shared/presentation/components/Container';
import { useShallow } from 'zustand/react/shallow';
import { useEditorStore } from '@/modules/fractal/presentation/stores/editor';
import '@/modules/canvas/presentation/components/organisms/TimestepControls/TimestepControls.css';

const TimestepControls: React.FC = () => {
    const {
        timestepData,
        currentTimestep,
        isPlaying,
        playSpeed,
        togglePlay,
        setPlaySpeed,
        setCurrentTimestep,
        isModelLoading
    } = useEditorStore(useShallow((state) => ({
        timestepData: state.timestepData,
        currentTimestep: state.currentTimestep,
        isPlaying: state.isPlaying,
        playSpeed: state.playSpeed,
        togglePlay: state.togglePlay,
        setPlaySpeed: state.setPlaySpeed,
        setCurrentTimestep: state.setCurrentTimestep,
        isModelLoading: state.isModelLoading
    })));

    if (currentTimestep === undefined) return null;

    const availableTimesteps = timestepData.timesteps;
    const currentIndex = availableTimesteps.indexOf(currentTimestep);
    const safeCurrentIndex = currentIndex !== -1 ? currentIndex : 0;
    const minIndex = 0;
    const maxIndex = availableTimesteps.length - 1;

    const handleSliderChange = (index: number) => {
        const roundedIndex = Math.round(index);
        if (roundedIndex >= 0 && roundedIndex < availableTimesteps.length) {
            const selectedTimestep = availableTimesteps[roundedIndex];
            setCurrentTimestep(selectedTimestep);
        }
    };

    const sliderProgress = maxIndex > 0 ? (safeCurrentIndex / maxIndex) * 100 : 0;

    return (
        <WidgetContainer className='editor-timestep-controls d-flex p-1 row items-center content-between'>
            <Tooltip content={isPlaying ? 'Pause' : 'Play'} placement='top'>
                <Button
                    onClick={togglePlay}
                    className='editor-timestep-controls-play-pause-button font-size-3 font-size-5 cursor-pointer b-none transition-normal'
                    variant='ghost'
                    iconOnly
                >
                    {isPlaying ? <CiPause1 /> : <CiPlay1 />}
                </Button>
            </Tooltip>

            <Container className='timestep-slider-wrapper p-relative flex-1'>
                <div className='d-flex items-center gap-05 editor-timesteps-controls-slider'>
                    <Slider
                        min={minIndex}
                        max={maxIndex}
                        value={safeCurrentIndex}
                        onChange={handleSliderChange}
                        step={1}
                        disabled={false}
                        className='editor-timestep-controls-slider'
                        style={{
                            '--progress': `${sliderProgress}%`
                        } as React.CSSProperties}
                    />
                    <span className='timestep-display color-secondary'>
                        {currentTimestep} / {timestepData.maxTimestep}
                    </span>
                </div>

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

            <div className='d-flex items-center gap-05 editor-timesteps-controls-speed'>
                Speed:
                <Slider
                    min={0.1}
                    max={10}
                    value={playSpeed}
                    onChange={setPlaySpeed}
                    step={0.1}
                    disabled={false}
                    className='speed-slider'
                    style={{
                        '--progress': `${(playSpeed / 10) * 100}%`
                    } as React.CSSProperties}
                />
                {playSpeed.toFixed(1)}x
            </div>
        </WidgetContainer>
    );
};

export default TimestepControls;
