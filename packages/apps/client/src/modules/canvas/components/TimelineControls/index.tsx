import PlaybackPopover from './PlaybackPopover';
import ZoomPresetPopover from './ZoomPresetPopover';
import TimestepField from './TimestepField';
import TransportControls from '../TransportControls';
import { useEditorStore } from '@/modules/canvas/store/editor';

import { memo } from 'react';
import type { ComponentProps } from 'react';
import type { FractalSceneRef } from '@/modules/fractal/contracts/scene-ref';

interface TimelineControlsProps extends ComponentProps<typeof PlaybackPopover> {
    trajectoryId?: string;
    currentTimestep: number | undefined;
    rangedTimesteps: number[];
    sceneRef: React.RefObject<FractalSceneRef | null>;
}

// Beside the ruler, as in OVITO: the transport, and under it the timestep, playback and zoom.
const TimelineControls = ({
    trajectoryId,
    currentTimestep,
    rangedTimesteps,
    sceneRef,
    ...playback
}: TimelineControlsProps) => {
    const setCurrentTimestep = useEditorStore((state) => state.setCurrentTimestep);

    return (
        <div className='flex flex-none flex-col items-center gap-0.5 max-md:pointer-events-auto max-md:w-full max-md:flex-row max-md:justify-between max-md:gap-1'>
            <div className='flex flex-row items-center max-md:contents'>
                <TransportControls
                    trajectoryId={trajectoryId}
                    currentTimestep={currentTimestep}
                    availableTimesteps={playback.availableTimesteps}
                />
            </div>
            <div className='flex flex-row items-center gap-1'>
                <TimestepField value={currentTimestep} timesteps={rangedTimesteps} onChange={setCurrentTimestep} />
                <PlaybackPopover {...playback} />
                <ZoomPresetPopover sceneRef={sceneRef} />
            </div>
        </div>
    );
};

export default memo(TimelineControls);
