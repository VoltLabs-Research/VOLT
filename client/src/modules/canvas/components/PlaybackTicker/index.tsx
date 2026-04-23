import { useEditorStore } from '@/modules/canvas/stores/editor';
import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';

const PlaybackTicker = () => {
    const isPlaying = useEditorStore((s) => s.isPlaying);
    const invalidate = useThree((state) => state.invalidate);

    useEffect(() => {
        if (!isPlaying) return;

        let rafId: number | null = null;
        const loop = (now: number) => {
            useEditorStore.getState().tick(now);
            invalidate();
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
