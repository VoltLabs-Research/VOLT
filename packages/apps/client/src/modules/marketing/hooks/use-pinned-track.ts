import { PINNED_MEDIA_QUERY } from '@/modules/marketing/contracts/steps';
import { useMedia } from '@/shared/ui/hooks/use-media';
import { useScrollProgress } from '@/modules/marketing/hooks/use-scroll-progress';
import { useMotionValueEvent } from 'framer-motion';
import { useRef, useState } from 'react';
import type { CSSProperties } from 'react';

// A track whose stage the page pins while it scrolls through it, a stretch of scroll for each
// of `steps` (see .landing-track): how far through it the page is, and the step it is in.
export const usePinnedTrack = (steps: number) => {
    const track = useRef<HTMLDivElement>(null);
    const progress = useScrollProgress(track, ['start start', 'end end']);
    const isPinned = useMedia(PINNED_MEDIA_QUERY);
    const toStep = (value: number) => Math.min(steps - 1, Math.floor(value * steps));
    const [step, setStep] = useState(() => toStep(progress.get()));

    useMotionValueEvent(progress, 'change', (value) => setStep(toStep(value)));

    return { track, progress, isPinned, step, style: { '--landing-steps': steps } as CSSProperties };
};
