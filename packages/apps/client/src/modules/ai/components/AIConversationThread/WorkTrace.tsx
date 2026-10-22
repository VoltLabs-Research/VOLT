import { isWorkLive } from '@/modules/ai/utils/message-blocks';
import { resolveImagePayload } from '@/modules/ai/utils/message-artifacts';
import { isFailedOutput, presentActivity } from '@/modules/ai/utils/tool-presentation';
import Prose from '@/shared/ui/components/Prose';
import { cn } from '@heroui/react';
import { Check, ChevronRight, LoaderCircle, X } from 'lucide-react';
import { useId, useState } from 'react';
import type { ToolActivity, WorkStep } from '@/modules/ai/utils/message-blocks';
import type { ReactNode } from 'react';

type StepTone = 'live' | 'done' | 'failed';

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

const StepMark = ({ tone }: { tone: StepTone }) => {
    if (tone === 'live') return <LoaderCircle size={14} className='shrink-0 text-foreground motion-safe:animate-spin' aria-hidden='true' />;
    if (tone === 'failed') return <X size={14} className='shrink-0 text-danger-soft-foreground' aria-hidden='true' />;
    return <Check size={14} className='shrink-0 text-muted' aria-hidden='true' />;
};

// Each step but the last draws the hairline down to the next one's mark, so the guide never
// needs a fill behind the marks to hide it, on the page or on the floating panel's glass.
const STEP_CLASS = cn(
    'relative flex items-start gap-2',
    'not-last:after:absolute not-last:after:top-4.5 not-last:after:-bottom-2.5 not-last:after:left-2 not-last:after:w-px not-last:after:bg-foreground/10'
);

const StepRow = ({ step }: { step: WorkStep }) => {
    let tone: StepTone;
    let detail: ReactNode = null;

    if (step.kind === 'reasoning') {
        tone = step.isStreaming ? 'live' : 'done';
        if (step.text !== '') {
            detail = (
                <div className='mt-1'>
                    <Prose size='sm'>{step.text}</Prose>
                </div>
            );
        }
    } else {
        tone = toneOf(step.activity);
        if (step.activity.outcome.kind === 'failed') {
            detail = <p className='mt-0.5 text-xs text-danger-soft-foreground'>{step.activity.outcome.error}</p>;
        }
    }

    return (
        <li className={STEP_CLASS}>
            <span className='mt-0.5 flex size-4 shrink-0 items-center justify-center'>
                <StepMark tone={tone} />
            </span>
            <div className='min-w-0 flex-1'>
                <p className='text-sm text-muted'>{stepLabel(step)}</p>
                {detail}
            </div>
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
        <div className='flex w-full min-w-0 flex-col gap-2'>
            <button
                type='button'
                onClick={() => setIsOpen((value) => !value)}
                aria-expanded={isOpen}
                aria-controls={listId}
                className='flex w-fit max-w-full cursor-pointer flex-row items-center gap-1 rounded-md text-left text-sm text-muted transition-colors hover:text-foreground'
            >
                <ChevronRight size={14} aria-hidden='true' className={cn('shrink-0 transition-transform duration-200', isOpen && 'rotate-90')} />
                {isLive && <StepMark tone='live' />}
                <span className='min-w-0 truncate' role={isLive ? 'status' : undefined}>{headlineOf(steps, isLive)}</span>
            </button>

            {isOpen && (
                <ol id={listId} className='m-0 flex list-none flex-col gap-2 py-0.5'>
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
                    className='block w-fit max-w-full overflow-hidden rounded-xl leading-none'
                >
                    <img
                        src={image.url}
                        alt={image.summary ?? 'Image from Volt AI'}
                        className='block h-auto max-w-full rounded-xl border border-foreground/8'
                        loading='lazy'
                    />
                </a>
            ))}
        </div>
    );
};

export default WorkTrace;
