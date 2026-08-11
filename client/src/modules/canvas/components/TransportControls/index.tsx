import { useEditorStore } from '@/modules/canvas/store/editor';
import { resolveRangedTimesteps } from '@/modules/canvas/utils/timeline-range';

import { SkipBack, Rewind, ChevronLeft, Play, ChevronRight, FastForward, SkipForward, Pause } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Button, Tooltip } from '@heroui/react';

interface TransportControlsProps {
    trajectoryId?: string;
    currentTimestep: number | undefined;
    availableTimesteps: number[];
}

const TransportControls = ({ trajectoryId, currentTimestep, availableTimesteps }: TransportControlsProps) => {
    const {
        isPlaying,
        togglePlay,
        setCurrentTimestep,
        rangeStart,
        rangeEnd
    } = useEditorStore(useShallow((state) => ({
        isPlaying: state.isPlaying,
        togglePlay: state.togglePlay,
        setCurrentTimestep: state.setCurrentTimestep,
        rangeStart: state.rangeStart,
        rangeEnd: state.rangeEnd
    })));

    const timesteps = useMemo(() => {
        return resolveRangedTimesteps(availableTimesteps, rangeStart, rangeEnd);
    }, [availableTimesteps, rangeStart, rangeEnd]);
    const currentIndex = currentTimestep !== undefined ? timesteps.indexOf(currentTimestep) : -1;

    const jumpToStart = useCallback(() => {
        if (timesteps.length === 0) return;
        setCurrentTimestep(timesteps[0]);
    }, [timesteps, setCurrentTimestep]);

    const jumpToEnd = useCallback(() => {
        if (timesteps.length === 0) return;
        setCurrentTimestep(timesteps[timesteps.length - 1]);
    }, [timesteps, setCurrentTimestep]);

    const jumpBack10 = useCallback(() => {
        if (timesteps.length === 0) return;
        const baseIndex = currentIndex === -1 ? 0 : currentIndex;
        const nextIndex = Math.max(0, baseIndex - 10);
        setCurrentTimestep(timesteps[nextIndex]);
    }, [timesteps, currentIndex, setCurrentTimestep]);

    const jumpForward10 = useCallback(() => {
        if (timesteps.length === 0) return;
        const baseIndex = currentIndex === -1 ? 0 : currentIndex;
        const nextIndex = Math.min(timesteps.length - 1, baseIndex + 10);
        setCurrentTimestep(timesteps[nextIndex]);
    }, [timesteps, currentIndex, setCurrentTimestep]);

    const prevTimestep = useCallback(() => {
        if (timesteps.length === 0) return;
        const nextIndex = currentIndex <= 0 ? 0 : currentIndex - 1;
        setCurrentTimestep(timesteps[nextIndex]);
    }, [timesteps, currentIndex, setCurrentTimestep]);

    const nextTimestep = useCallback(() => {
        if (timesteps.length === 0) return;
        const nextIndex = currentIndex === -1 ? 0 : Math.min(currentIndex + 1, timesteps.length - 1);
        setCurrentTimestep(timesteps[nextIndex]);
    }, [timesteps, currentIndex, setCurrentTimestep]);

    const handleTogglePlay = useCallback(() => {
        togglePlay({
            trajectoryId,
            timesteps: availableTimesteps
        });
    }, [togglePlay, trajectoryId, availableTimesteps]);

    const buttons = useMemo(() => ([
        {
            action: 'start',
            Icon: SkipBack,
            label: 'Jump to start',
            onPress: jumpToStart
        },
        {
            action: 'back-10',
            Icon: Rewind,
            label: 'Back 10 timesteps',
            onPress: jumpBack10
        },
        {
            action: 'previous',
            Icon: ChevronLeft,
            label: 'Previous timestep',
            onPress: prevTimestep
        },
        {
            action: 'play',
            Icon: isPlaying ? Pause : Play,
            label: isPlaying ? 'Pause' : 'Play',
            onPress: handleTogglePlay
        },
        {
            action: 'next',
            Icon: ChevronRight,
            label: 'Next timestep',
            onPress: nextTimestep
        },
        {
            action: 'forward-10',
            Icon: FastForward,
            label: 'Forward 10 timesteps',
            onPress: jumpForward10
        },
        {
            action: 'end',
            Icon: SkipForward,
            label: 'Jump to end',
            onPress: jumpToEnd
        }
    ]), [isPlaying, handleTogglePlay, jumpToStart, jumpBack10, prevTimestep, nextTimestep, jumpForward10, jumpToEnd]);

    const renderButton = (btn: typeof buttons[number]) => (
        <Tooltip key={btn.action}>
            <Button
                variant='ghost'
                size='sm'
                className='rounded-full'
                isIconOnly
                aria-label={btn.label}
                data-transport-action={btn.action}
                onPress={btn.onPress}
            >
                <btn.Icon style={{
                    width: 13,
                    height: 13
                }} />
            </Button>
            <Tooltip.Content placement='top'>{btn.label}</Tooltip.Content>
        </Tooltip>
    );

    const previousButton = buttons[2];
    const playButton = buttons[3];
    const nextButton = buttons[4];

    return (
        <>
            <div className='flex flex-row items-center gap-0.5 max-md:hidden'>
                {buttons.map(renderButton)}
            </div>
            <div className='hidden max-md:contents'>
                <div className='canvas-transport-mobile-step-controls flex flex-row items-center max-md:rounded-xl max-md:bg-surface-secondary max-md:flex-none max-md:gap-0.5 max-md:[&_button]:size-[1.875rem] max-md:[&_button]:min-h-[1.875rem]'>
                    {renderButton(previousButton)}
                    {renderButton(nextButton)}
                </div>
                <div className='flex flex-row items-center max-md:flex-none max-md:gap-0.5 max-md:[&_button]:size-[1.875rem] max-md:[&_button]:min-h-[1.875rem]'>
                    {renderButton(playButton)}
                </div>
            </div>
        </>
    );
};

export default TransportControls;
