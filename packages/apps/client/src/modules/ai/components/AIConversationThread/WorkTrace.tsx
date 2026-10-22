import { isWorkLive } from '@/modules/ai/utils/message-blocks';
import { resolveImagePayload } from '@/modules/ai/utils/message-artifacts';
import { isFailedOutput, presentActivity } from '@/modules/ai/utils/tool-presentation';
import Prose from '@/shared/ui/components/Prose';
import { cn } from '@heroui/react';
import { ChevronRight } from 'lucide-react';
import { useId, useState } from 'react';
import type { ToolActivity, WorkStep } from '@/modules/ai/utils/message-blocks';

type StepTone = 'live' | 'done' | 'failed';

const TONE_DOT: Record<StepTone, string> = {
    live: 'bg-warning animate-pulse',
    done: 'bg-success',
    failed: 'bg-danger'
};

const toneOf = ({ outcome }: ToolActivity): StepTone => {
    if (outcome.kind === 'running') return 'live';
    if (outcome.kind === 'failed' || outcome.kind === 'declined') return 'failed';
    if (outcome.kind === 'done' && isFailedOutput(outcome.output)) return 'failed';
    return 'done';
};

const formatDuration = (durationMs: number): string => {
    const seconds = Math.round(durationMs / 1000);
    if (seconds < 1) return 'a moment';
    if (seconds < 60) return `${seconds}s`;

    const minutes = Math.floor(seconds / 60);
    const rest = seconds % 60;
    return rest === 0 ? `${minutes}m` : `${minutes}m ${rest}s`;
};

const stepLabel = (step: WorkStep): string => {
    if (step.kind === 'tool') return presentActivity(step.activity);
    if (step.isStreaming) return 'Thinking…';
    return step.durationMs === null ? 'Thought it through' : `Thought for ${formatDuration(step.durationMs)}`;
};

// One line for the whole trace: what is happening now while it runs, what it came to once done.
const headlineOf = (steps: WorkStep[], isLive: boolean): string => {
    if (isLive) return stepLabel(steps[steps.length - 1]);

    const tools = steps.flatMap((step) => (step.kind === 'tool' ? [step.activity] : []));
    if (tools.length === 0) {
        const thought = steps.reduce((total, step) => total + (step.kind === 'reasoning' ? step.durationMs ?? 0 : 0), 0);
        return thought > 0 ? `Thought for ${formatDuration(thought)}` : 'Thought it through';
    }

    const failed = tools.filter((activity) => toneOf(activity) === 'failed').length;
    const used = `Used ${tools.length} ${tools.length === 1 ? 'tool' : 'tools'}`;
    return failed === 0 ? used : `${used}, ${failed} failed`;
};

const StepRow = ({ step }: { step: WorkStep }) => {
    if (step.kind === 'reasoning') {
        return (
            <li className='flex flex-col gap-1'>
                <p className='text-2xs text-muted'>{stepLabel(step)}</p>
                {step.text !== '' && (
                    <div className='border-l-2 border-border pl-3'>
                        <Prose size='sm'>{step.text}</Prose>
                    </div>
                )}
            </li>
        );
    }

    const { activity } = step;
    const tone = toneOf(activity);

    return (
        <li className='flex flex-col gap-0.5'>
            <div className='flex flex-row items-center gap-2'>
                <span className={cn('size-1.5 shrink-0 rounded-full', TONE_DOT[tone])} aria-hidden='true' />
                <p className='min-w-0 text-xs text-muted'>{presentActivity(activity)}</p>
            </div>
            {activity.outcome.kind === 'failed' && (
                <p className='pl-3.5 text-2xs text-danger'>{activity.outcome.error}</p>
            )}
        </li>
    );
};

interface WorkTraceProps {
    steps: WorkStep[];
}

const WorkTrace = ({ steps }: WorkTraceProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const listId = useId();
    const isLive = isWorkLive(steps);
    const images = steps.flatMap((step) => {
        if (step.kind !== 'tool' || step.activity.outcome.kind !== 'done') return [];

        const image = resolveImagePayload(step.activity.outcome.output);
        return image === null ? [] : [{
            key: step.activity.toolCallId,
            ...image
        }];
    });

    return (
        <div className='flex w-full min-w-0 flex-col gap-1.5'>
            <button
                type='button'
                onClick={() => setIsOpen((value) => !value)}
                aria-expanded={isOpen}
                aria-controls={listId}
                className='flex w-fit max-w-full cursor-pointer flex-row items-center gap-1.5 rounded-md border-none bg-transparent p-0 text-left text-xs text-muted hover:text-foreground'
            >
                <ChevronRight size={12} aria-hidden='true' className={cn('shrink-0 transition-transform duration-200', isOpen && 'rotate-90')} />
                {isLive && <span className={cn('size-1.5 shrink-0 rounded-full', TONE_DOT.live)} aria-hidden='true' />}
                <span className='min-w-0 truncate' role={isLive ? 'status' : undefined}>{headlineOf(steps, isLive)}</span>
            </button>

            {isOpen && (
                <ol id={listId} className='m-0 flex list-none flex-col gap-2 border-l-2 border-border py-0.5 pl-3'>
                    {steps.map((step, index) => (
                        <StepRow key={step.kind === 'tool' ? step.activity.toolCallId : `reasoning-${index}`} step={step} />
                    ))}
                </ol>
            )}

            {images.map((image) => (
                <a
                    key={image.key}
                    href={image.url}
                    target='_blank'
                    rel='noreferrer'
                    className='block w-fit max-w-full overflow-hidden rounded-lg leading-none'
                >
                    <img
                        src={image.url}
                        alt={image.summary ?? 'Image from Volt AI'}
                        className='block h-auto max-w-full rounded-lg border border-border'
                        loading='lazy'
                    />
                </a>
            ))}
        </div>
    );
};

export default WorkTrace;
