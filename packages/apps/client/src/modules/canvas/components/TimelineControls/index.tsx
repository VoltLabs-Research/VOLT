import PlaybackPopover from './PlaybackPopover';
import PresetPopover from './PresetPopover';
import TimestepField from './TimestepField';
import TransportControls from '../TransportControls';
import { useEditorStore } from '@/modules/canvas/store/editor';

import { ZoomIn } from 'lucide-react';
import type { ComponentProps } from 'react';

const ZOOM_PRESETS = [25, 50, 75, 100, 125, 150, 200, 400];

interface TimelineControlsProps extends ComponentProps<typeof PlaybackPopover> {
    trajectoryId?: string;
    currentTimestep: number | undefined;
    rangedTimesteps: number[];
    zoomPercent: number;
    onZoomPreset: (preset: number) => void;
}

// Beside the ruler, as in OVITO: the transport, and under it the timestep, playback and zoom.
const TimelineControls = ({
    trajectoryId,
    currentTimestep,
    rangedTimesteps,
    zoomPercent,
    onZoomPreset,
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
                <PresetPopover
                    id='timeline-zoom'
                    icon={<ZoomIn size={12} />}
                    presets={ZOOM_PRESETS}
                    value={zoomPercent}
                    suffix='%'
                    onSelect={onZoomPreset}
                    hideOnMobile
                />
            </div>
        </div>
    );
};

export default TimelineControls;
