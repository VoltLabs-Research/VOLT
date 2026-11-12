import { useEditorStore } from '@/modules/canvas/store/editor';
import { resolveRangedTimesteps } from '@/modules/canvas/utils/timeline-range';

import { SkipBack, ChevronLeft, Play, ChevronRight, SkipForward, Pause, Square } from 'lucide-react';
import { useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Button, Tooltip } from '@heroui/react';

interface TransportControlsProps {
    trajectoryId?: string;
    currentTimestep: number | undefined;
    availableTimesteps: number[];
}

const ICON_STYLE = { width: 13, height: 13 };
const GLYPH_POP: Keyframe[] = [{ opacity: 0, transform: 'scale(0.5)' }, { opacity: 1, transform: 'none' }];
const GLYPH_POP_TIMING: KeyframeAnimationOptions = { duration: 300, easing: 'cubic-bezier(0.34, 1.36, 0.64, 1)' };

const TransportControls = ({ trajectoryId, currentTimestep, availableTimesteps }: TransportControlsProps) => {
    const {
        isPlaying,
        isPreloading,
        togglePlay,
        setCurrentTimestep,
        rangeStart,
        rangeEnd
    } = useEditorStore(useShallow((state) => ({
        isPlaying: state.isPlaying,
        isPreloading: Boolean(state.isPreloading),
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
            action: 'previous',
            Icon: ChevronLeft,
            label: 'Previous timestep',
            onPress: prevTimestep
        },
        // While Play caches frames, PlaybackCachingIsland shows the progress; the button only turns
        // into Stop, drawn like its neighbours, and pressing it cancels.
        {
            action: 'play',
            Icon: isPreloading ? Square : isPlaying ? Pause : Play,
            label: isPreloading ? 'Cancel caching' : isPlaying ? 'Pause' : 'Play',
            onPress: handleTogglePlay
        },
        {
            action: 'next',
            Icon: ChevronRight,
            label: 'Next timestep',
            onPress: nextTimestep
        },
        {
            action: 'end',
            Icon: SkipForward,
            label: 'Jump to end',
            onPress: jumpToEnd
        }
    ]), [isPlaying, isPreloading, handleTogglePlay, jumpToStart, prevTimestep, nextTimestep, jumpToEnd]);

    // A press gives more than HeroUI's 0.97.
    const renderButton = (btn: typeof buttons[number]) => (
        <Tooltip key={btn.action}>
            <Button
                variant='ghost'
                size='sm'
                isIconOnly
                aria-label={btn.label}
                data-transport-action={btn.action}
                className='data-[pressed=true]:scale-[0.88]'
                onPress={btn.onPress}
            >
                <btn.Icon ref={btn.action === 'play' ? playGlyphRef : undefined} style={ICON_STYLE} />
            </Button>
            <Tooltip.Content placement='top'>{btn.label}</Tooltip.Content>
        </Tooltip>
    );

    // Play, Pause and Stop pop in as they swap. Web Animations, not a CSS animation: in the canvas dock, Chrome
    // (149) left a CSS animation on the freshly mounted glyph painted at its first frame, faded and half its size.
    const playGlyphRef = useRef<SVGSVGElement>(null);
    const playLabel = buttons[2].label;
    const shownPlayLabelRef = useRef(playLabel);
    useLayoutEffect(() => {
        if (shownPlayLabelRef.current === playLabel) return;
        shownPlayLabelRef.current = playLabel;
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        playGlyphRef.current?.animate(GLYPH_POP, GLYPH_POP_TIMING);
    }, [playLabel]);

    const previousButton = buttons[1];
    const playButton = buttons[2];
    const nextButton = buttons[3];

    return (
        <>
            <div className='flex flex-row items-center gap-0.5 max-md:hidden'>
                {buttons.map(renderButton)}
            </div>
            <div className='hidden max-md:contents'>
                <div className='flex flex-row items-center max-md:flex-none max-md:gap-0.5 max-md:[&_button]:size-7 max-md:[&_button]:min-h-7'>
                    {renderButton(previousButton)}
                    {renderButton(nextButton)}
                </div>
                <div className='flex flex-row items-center max-md:flex-none max-md:gap-0.5 max-md:[&_button]:size-7 max-md:[&_button]:min-h-7'>
                    {renderButton(playButton)}
                </div>
            </div>
        </>
    );
};

export default TransportControls;
