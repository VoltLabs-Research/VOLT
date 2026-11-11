import { Button, ProgressCircle, Tooltip, cn } from '@heroui/react';
import { X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useEditorStore } from '@/modules/canvas/store/editor';

// After the last timestep lands, the island stays a moment on its full ring while playback begins.
const HOLD_MS = 520;

interface IslandProgress {
    count: number;
    total: number;
    share: number;
}

// While Play caches the frames it is about to play, this is the one place that says so: a dark
// capsule over the scene, above the timeline, with the share cached and a way to cancel.
const PlaybackCachingIsland = () => {
    const { isPreloading, preloadProgress, preloadTotal, stopPlayback } = useEditorStore(useShallow((state) => ({
        isPreloading: Boolean(state.isPreloading),
        preloadProgress: state.preloadProgress ?? 0,
        preloadTotal: state.preloadTotal,
        stopPlayback: state.stopPlayback
    })));
    const [heldTotal, setHeldTotal] = useState(0);
    const lastProgress = useRef<IslandProgress>({ count: 0, total: 0, share: 0 });

    // The store clears the count once caching ends; a run that finished (rather than one cancelled
    // or failed part-way) keeps the island on its full ring for HOLD_MS.
    useEffect(() => {
        let timer: number | undefined;
        const unsubscribe = useEditorStore.subscribe((state, previous) => {
            if (state.isPreloading && !previous.isPreloading) {
                window.clearTimeout(timer);
                setHeldTotal(0);
                return;
            }
            if (!previous.isPreloading || state.isPreloading) return;
            if ((state.preloadProgress ?? 0) < 1 || previous.preloadTotal === 0) return;
            setHeldTotal(previous.preloadTotal);
            window.clearTimeout(timer);
            timer = window.setTimeout(() => setHeldTotal(0), HOLD_MS);
        });
        return () => {
            unsubscribe();
            window.clearTimeout(timer);
        };
    }, []);

    const open = isPreloading || heldTotal > 0;
    if (isPreloading) {
        lastProgress.current = {
            count: Math.round(preloadProgress * preloadTotal),
            total: preloadTotal,
            share: preloadProgress
        };
    } else if (heldTotal > 0) {
        lastProgress.current = { count: heldTotal, total: heldTotal, share: 1 };
    }
    // Closed, it keeps showing what it last showed while it fades away.
    const { count, total, share } = lastProgress.current;

    return (
        <div
            className={cn(
                'playback-island absolute bottom-full left-1/2 mb-3 flex h-10 -translate-x-1/2 flex-row items-center gap-2 rounded-full px-1.5 motion-reduce:translate-y-0 motion-reduce:scale-100',
                // While it fades away it no longer takes clicks meant for the scene below.
                open ? 'pointer-events-auto visible translate-y-0 scale-100 opacity-100' : 'pointer-events-none invisible translate-y-2.5 scale-94 opacity-0'
            )}
            data-open={open || undefined}
            role='status'
            aria-live='polite'
            aria-hidden={!open}
        >
            <ProgressCircle aria-hidden='true' value={share * 100}>
                <ProgressCircle.Track>
                    <ProgressCircle.TrackCircle strokeWidth={3} />
                    <ProgressCircle.FillCircle strokeWidth={3} />
                </ProgressCircle.Track>
            </ProgressCircle>
            <span className='ml-0.5 whitespace-nowrap text-sm font-semibold'>Preparing playback</span>
            <span className='min-w-17 whitespace-nowrap text-sm tabular-nums text-[var(--island-muted)]'>
                {total > 0 ? `${count} of ${total}` : ''}
            </span>
            <Tooltip>
                <Button
                    variant='ghost'
                    size='sm'
                    isIconOnly
                    aria-label='Cancel caching'
                    className='playback-island__close size-7 min-h-7 min-w-7 rounded-full'
                    onPress={stopPlayback}
                    isDisabled={!isPreloading}
                >
                    <X style={{ width: 12, height: 12 }} strokeWidth={2.75} />
                </Button>
                <Tooltip.Content placement='top'>Cancel caching</Tooltip.Content>
            </Tooltip>
        </div>
    );
};

export default PlaybackCachingIsland;
