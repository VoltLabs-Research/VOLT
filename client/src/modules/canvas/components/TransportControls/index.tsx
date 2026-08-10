import { useEditorStore } from '@/modules/canvas/store/editor';
import { resolveRangedTimesteps } from '@/modules/canvas/utils/timeline-range';

import { SkipBack, Rewind, ChevronLeft, Play, ChevronRight, FastForward, SkipForward, Pause } from 'lucide-react';
import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Button, Tooltip } from '@heroui/react';

interface TransportControlsProps {
    trajectoryId?: string;
    currentTimestep: number | undefined;
    availableTimesteps: number[];
}

/**
 * `.canvas-transport-mobile-step-controls` / `-play-control` shrank every button to
 * 30px under 768px, and the step group additionally picked up the canvas floating
 * surface (12px radius over `--surface-secondary`) from `CanvasPage.css`. Both are
 * expressed here as descendant variants on the group so the shared `renderButton`
 * stays a single function.
 */
const MOBILE_GROUP_CLASS = 'max-md:flex-none max-md:gap-0.5 max-md:[&_button]:size-[1.875rem] max-md:[&_button]:min-h-[1.875rem]';

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

    const jumpToStart = () => {
        if (timesteps.length === 0) return;
        setCurrentTimestep(timesteps[0]);
    };

    const jumpToEnd = () => {
        if (timesteps.length === 0) return;
        setCurrentTimestep(timesteps[timesteps.length - 1]);
    };

    const jumpBack10 = () => {
        if (timesteps.length === 0) return;
        const baseIndex = currentIndex === -1 ? 0 : currentIndex;
        const nextIndex = Math.max(0, baseIndex - 10);
        setCurrentTimestep(timesteps[nextIndex]);
    };

    const jumpForward10 = () => {
        if (timesteps.length === 0) return;
        const baseIndex = currentIndex === -1 ? 0 : currentIndex;
        const nextIndex = Math.min(timesteps.length - 1, baseIndex + 10);
        setCurrentTimestep(timesteps[nextIndex]);
    };

    const prevTimestep = () => {
        if (timesteps.length === 0) return;
        const nextIndex = currentIndex <= 0 ? 0 : currentIndex - 1;
        setCurrentTimestep(timesteps[nextIndex]);
    };

    const nextTimestep = () => {
        if (timesteps.length === 0) return;
        const nextIndex = currentIndex === -1 ? 0 : Math.min(currentIndex + 1, timesteps.length - 1);
        setCurrentTimestep(timesteps[nextIndex]);
    };

    const handleTogglePlay = () => {
        togglePlay({
            trajectoryId,
            timesteps: availableTimesteps
        });
    };

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

    /*
     * The `title` these buttons carried becomes a `Tooltip`, because HeroUI's `Button`
     * has a closed prop interface with no `title` (spec §5b.8). The Button is the
     * Tooltip's direct child rather than being wrapped in `Tooltip.Trigger` — the
     * idiom `ThemeToggleButton` established — so no extra `role='button'` element and
     * no extra tab stop appears in a seven-control transport bar.
     */
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
                <div className={`canvas-transport-mobile-step-controls flex flex-row items-center max-md:rounded-xl max-md:bg-surface-secondary ${MOBILE_GROUP_CLASS}`}>
                    {renderButton(previousButton)}
                    {renderButton(nextButton)}
                </div>
                <div className={`flex flex-row items-center ${MOBILE_GROUP_CLASS}`}>
                    {renderButton(playButton)}
                </div>
            </div>
        </>
    );
};

export default TransportControls;
