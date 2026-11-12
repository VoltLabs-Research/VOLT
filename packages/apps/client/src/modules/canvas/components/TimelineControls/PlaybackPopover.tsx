import CanvasOptionSelect from '../CanvasOptionSelect';
import FrameCombobox from '../FrameCombobox';

import { Button, Popover } from '@heroui/react';
import { memo } from 'react';
import type { SelectOption } from '@/shared/contracts/form-field';

const SPEED_PRESETS = [0.25, 0.5, 1, 2, 4, 8, 10];
const SPEED_OPTIONS: SelectOption[] = SPEED_PRESETS.map((speed) => ({ value: String(speed), title: `${speed}x` }));

interface PlaybackPopoverProps {
    playSpeed: number;
    onPlaySpeedChange: (speed: number) => void;
    startFrame: number | undefined;
    endFrame: number | undefined;
    availableTimesteps: number[];
    onRangeStartChange: (value: number | undefined) => void;
    onRangeEndChange: (value: number | undefined) => void;
}

// OVITO's animation settings: the speed and the range Play goes through, behind the speed it shows.
const PlaybackPopover = ({
    playSpeed,
    onPlaySpeedChange,
    startFrame,
    endFrame,
    availableTimesteps,
    onRangeStartChange,
    onRangeEndChange
}: PlaybackPopoverProps) => (
    <Popover>
        <Button variant='ghost' size='sm' className='h-7 min-h-7 px-2.5 text-xs tabular-nums' aria-label={`Playback, ${playSpeed}x`}>
            {`${playSpeed}x`}
        </Button>
        <Popover.Content placement='top'>
            <Popover.Dialog aria-label='Playback' className='grid w-64 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 p-3'>
                <span className='col-span-2 text-2xs font-medium text-muted'>Playback</span>
                <span className='text-xs text-muted'>Speed</span>
                <CanvasOptionSelect
                    ariaLabel='Playback speed'
                    options={SPEED_OPTIONS}
                    value={String(playSpeed)}
                    onChange={(value) => onPlaySpeedChange(Number(value))}
                    triggerClassName='h-7 min-h-7 items-center rounded-full border-0 bg-foreground/5 py-0 pl-3 text-xs shadow-none hover:bg-foreground/[0.08]'
                />
                <span className='text-xs text-muted'>Start</span>
                <FrameCombobox value={startFrame} options={availableTimesteps} onChange={onRangeStartChange} title='Start timestep' groupClassName='w-full' />
                <span className='text-xs text-muted'>End</span>
                <FrameCombobox value={endFrame} options={availableTimesteps} onChange={onRangeEndChange} title='End timestep' groupClassName='w-full' />
            </Popover.Dialog>
        </Popover.Content>
    </Popover>
);

export default memo(PlaybackPopover);
