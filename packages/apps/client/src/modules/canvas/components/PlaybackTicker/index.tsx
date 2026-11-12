import { useEditorStore } from '@/modules/canvas/store/editor';
import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';

const PlaybackTicker = () => {
    const isPlaying = useEditorStore((s) => s.isPlaying);
    const invalidate = useThree((state) => state.invalidate);

    useEffect(() => {
        if (!isPlaying) return;

        let rafId: number | null = null;
        // Draws when the timestep moves, not on every display frame: between steps the scene is the same.
        const loop = (now: number) => {
            const previousTimestep = useEditorStore.getState().currentTimestep;
            useEditorStore.getState().tick(now);
            if (useEditorStore.getState().currentTimestep !== previousTimestep) invalidate();
            rafId = requestAnimationFrame(loop);
        };
        rafId = requestAnimationFrame(loop);

        return () => {
            if (rafId !== null) cancelAnimationFrame(rafId);
        };
    }, [isPlaying, invalidate]);

    return null;
};

export default PlaybackTicker;
