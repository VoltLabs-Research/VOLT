import { Button, Popover, Separator, Tooltip, cn } from '@heroui/react';
import { ChevronLeft, ChevronRight, FastForward, Pause, Play, Rewind, SkipBack, SkipForward } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import Scrollable from '@/shared/ui/components/Scrollable';

interface RunTimelineProps {
    timesteps: number[];
    index: number;
    onIndexChange: (index: number) => void;
    failedTimesteps: ReadonlySet<number>;
}

const SPEED_PRESETS = [0.25, 0.5, 1, 2, 4, 8, 10];
const BASE_FRAME_MS = 140;
const ICON_STYLE = { width: 13, height: 13 };

/*
 * The canvas timeline (TimelineHeader, TransportControls, FrameCombobox, TimelineRuler) floating over the
 * report: transport in the middle, the timestep and the speed on the right, the ruler of timesteps below.
 */
const RunTimeline = ({ timesteps, index, onIndexChange, failedTimesteps }: RunTimelineProps) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [speed, setSpeed] = useState(1);
    const [isSpeedOpen, setIsSpeedOpen] = useState(false);
    const [draft, setDraft] = useState<string | null>(null);
    const [playheadLeft, setPlayheadLeft] = useState(0);
    const rulerRef = useRef<HTMLDivElement>(null);
    const draggingRef = useRef(false);
    const last = timesteps.length - 1;

    const clamp = useCallback((value: number) => Math.max(0, Math.min(last, value)), [last]);

    useEffect(() => {
        if (!isPlaying) return undefined;
        if (index >= last) {
            setIsPlaying(false);
            return undefined;
        }
        const timeout = window.setTimeout(() => onIndexChange(index + 1), BASE_FRAME_MS / speed);
        return () => window.clearTimeout(timeout);
    }, [isPlaying, index, last, speed, onIndexChange]);

    useLayoutEffect(() => {
        const ruler = rulerRef.current;
        const tick = ruler?.querySelector<HTMLElement>(`[data-tick-index="${index}"]`);
        if (!ruler || !tick) return;
        const center = tick.offsetLeft + tick.offsetWidth / 2;
        setPlayheadLeft(center);
        if (center < ruler.scrollLeft + 48 || center > ruler.scrollLeft + ruler.clientWidth - 48) {
            ruler.scrollLeft = center - ruler.clientWidth / 2;
        }
    }, [index, timesteps]);

    const togglePlay = () => {
        if (!isPlaying && index >= last) onIndexChange(0);
        setIsPlaying((current) => !current);
    };

    const buttons: { action: string; Icon: LucideIcon; label: string; onPress: () => void }[] = [
        { action: 'start', Icon: SkipBack, label: 'Jump to start', onPress: () => onIndexChange(0) },
        { action: 'back-10', Icon: Rewind, label: 'Back 10 timesteps', onPress: () => onIndexChange(clamp(index - 10)) },
        { action: 'previous', Icon: ChevronLeft, label: 'Previous timestep', onPress: () => onIndexChange(clamp(index - 1)) },
        { action: 'play', Icon: isPlaying ? Pause : Play, label: isPlaying ? 'Pause' : 'Play', onPress: togglePlay },
        { action: 'next', Icon: ChevronRight, label: 'Next timestep', onPress: () => onIndexChange(clamp(index + 1)) },
        { action: 'forward-10', Icon: FastForward, label: 'Forward 10 timesteps', onPress: () => onIndexChange(clamp(index + 10)) },
        { action: 'end', Icon: SkipForward, label: 'Jump to end', onPress: () => onIndexChange(last) }
    ];

    const indexAtX = (clientX: number): number => {
        const ruler = rulerRef.current;
        if (!ruler) return index;
        let best = index;
        let bestDistance = Infinity;
        ruler.querySelectorAll<HTMLElement>('[data-tick-index]').forEach((tick) => {
            const bounds = tick.getBoundingClientRect();
            const distance = Math.abs(bounds.left + bounds.width / 2 - clientX);
            if (distance < bestDistance) {
                bestDistance = distance;
                best = Number(tick.dataset.tickIndex);
            }
        });
        return best;
    };

    const commitDraft = () => {
        if (draft === null) return;
        const target = Number(draft.replace(/[^0-9.-]/g, ''));
        if (draft.trim() && Number.isFinite(target)) {
            let best = 0;
            timesteps.forEach((timestep, position) => {
                if (Math.abs(timestep - target) < Math.abs(timesteps[best] - target)) best = position;
            });
            onIndexChange(best);
        }
        setDraft(null);
    };

    const handleRulerKey = (event: React.KeyboardEvent) => {
        const steps: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, PageUp: -10, PageDown: 10 };
        if (event.key in steps) {
            event.preventDefault();
            onIndexChange(clamp(index + steps[event.key]));
        } else if (event.key === 'Home' || event.key === 'End') {
            event.preventDefault();
            onIndexChange(event.key === 'Home' ? 0 : last);
        } else if (event.key === ' ') {
            event.preventDefault();
            togglePlay();
        }
    };

    return (
        <div
            role='group'
            aria-label='Timeline'
            className='sticky bottom-4 z-20 mx-auto mt-7 flex w-full max-w-[780px] flex-col rounded-2xl bg-dashboard-surface px-1.5 pb-1.5 shadow-overlay backdrop-blur-[16px] backdrop-saturate-[1.2]'
        >
            <div className='relative flex h-10 flex-row items-center px-1.5 py-1'>
                <div className='flex min-w-0 flex-1 items-baseline gap-1 text-xs tabular-nums text-muted'>
                    <span>Frame</span>
                    <span className='font-medium text-foreground'>{index}</span>
                    <span>/ {last}</span>
                    {failedTimesteps.has(timesteps[index]) && <span className='ml-1.5 text-danger'>failed</span>}
                </div>
                <div className='absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-row items-center gap-0.5'>
                    {buttons.map((button) => (
                        <Tooltip key={button.action}>
                            <Button variant='ghost' size='sm' isIconOnly aria-label={button.label} onPress={button.onPress}>
                                <button.Icon style={ICON_STYLE} />
                            </Button>
                            <Tooltip.Content placement='top'>{button.label}</Tooltip.Content>
                        </Tooltip>
                    ))}
                </div>
                <div className='flex flex-1 items-center justify-end gap-2'>
                    <input
                        value={draft ?? String(timesteps[index] ?? '')}
                        onChange={(event) => setDraft(event.target.value)}
                        onBlur={commitDraft}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') commitDraft();
                            if (event.key === 'Escape') setDraft(null);
                        }}
                        inputMode='numeric'
                        aria-label='Timestep'
                        className='h-7 w-24 rounded-full border-0 bg-foreground/5 pl-3 text-xs tabular-nums text-foreground outline-none transition-colors duration-[140ms] hover:bg-foreground/[0.08] focus:bg-foreground/[0.08]'
                    />
                    <Separator orientation='vertical' className='h-4 shrink-0' />
                    <Popover isOpen={isSpeedOpen} onOpenChange={setIsSpeedOpen}>
                        <Button variant='ghost' size='sm' className='h-7 min-h-7 gap-1.5 px-2.5 text-xs tabular-nums [&_svg]:text-muted'>
                            <FastForward size={12} />
                            {`${speed}x`}
                        </Button>
                        <Popover.Content placement='top end'>
                            <Popover.Dialog aria-label='Playback speed' className='flex min-w-28 flex-col gap-0.5 p-1.5'>
                                {SPEED_PRESETS.map((preset) => (
                                    <Button
                                        key={preset}
                                        variant={preset === speed ? 'secondary' : 'ghost'}
                                        size='sm'
                                        fullWidth
                                        className='justify-start text-xs tabular-nums'
                                        onPress={() => {
                                            setSpeed(preset);
                                            setIsSpeedOpen(false);
                                        }}
                                    >
                                        {`${preset}x`}
                                    </Button>
                                ))}
                            </Popover.Dialog>
                        </Popover.Content>
                    </Popover>
                </div>
            </div>
            <div className='relative h-7'>
                <Scrollable
                    orientation='horizontal'
                    ref={rulerRef}
                    role='slider'
                    tabIndex={0}
                    aria-label='Timeline playhead'
                    aria-valuemin={timesteps[0]}
                    aria-valuemax={timesteps[last]}
                    aria-valuenow={timesteps[index]}
                    aria-valuetext={`Frame ${index}, timestep ${timesteps[index]}`}
                    onKeyDown={handleRulerKey}
                    onPointerDown={(event) => {
                        draggingRef.current = true;
                        event.currentTarget.setPointerCapture(event.pointerId);
                        onIndexChange(indexAtX(event.clientX));
                    }}
                    onPointerMove={(event) => {
                        if (!draggingRef.current) return;
                        const next = indexAtX(event.clientX);
                        if (next !== index) onIndexChange(next);
                    }}
                    onPointerUp={() => { draggingRef.current = false; }}
                    onPointerCancel={() => { draggingRef.current = false; }}
                    onWheel={(event) => {
                        if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) event.currentTarget.scrollLeft += event.deltaY;
                    }}
                    className='relative flex h-full cursor-pointer touch-pan-y select-none items-end overflow-y-hidden border-b border-foreground/[0.08] outline-none focus-visible:shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--foreground)_15%,transparent)]'
                >
                    {timesteps.map((timestep, position) => {
                        const failed = failedTimesteps.has(timestep);
                        return (
                            <div key={timestep} data-tick-index={position} className='relative flex h-full shrink-0 flex-col items-center justify-end gap-1 px-3'>
                                <span className={cn('whitespace-nowrap text-xs leading-none tabular-nums transition-colors duration-[180ms]', position === index ? 'text-foreground' : failed ? 'text-danger' : 'text-muted')}>
                                    {timestep}
                                </span>
                                <div className={cn('h-2.5 w-px', failed ? 'bg-danger' : 'bg-muted')} />
                            </div>
                        );
                    })}
                    <div className='pointer-events-none absolute bottom-0 top-4 z-[2] w-0.5 -translate-x-1/2 bg-foreground' style={{ left: playheadLeft }}>
                        <div className='absolute -top-1 left-1/2 size-2 -translate-x-1/2 rounded-full bg-foreground' />
                    </div>
                </Scrollable>
            </div>
        </div>
    );
};

export default RunTimeline;
