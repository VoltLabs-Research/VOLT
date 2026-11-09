import useAnalysisFrameLog from './use-analysis-frame-log';
import JobProgressBar from '@/modules/jobs/components/JobProgressBar';
import { useFrameJobProgress } from '@/modules/jobs/hooks/use-job-progress';
import { formatProgressPercent } from '@/modules/jobs/utils/job-progress';
import { format, isValid } from 'date-fns';
import { useEffect, useMemo, useRef, useState } from 'react';
import Scrollable from '@/shared/ui/components/Scrollable';
import { cn } from '@heroui/react';

interface AnalysisLogPanelProps {
    // Plugin whose output is shown; the panel follows the running stage, so it can change mid-run.
    title?: string;
    analysisId?: string;
    timestep?: number;
    active?: boolean;
    live?: boolean;
    activityStatus?: 'queued' | 'running' | 'completed' | 'failed';
}

// The status is carried by the plugin name's color, same tones as the viewport execution overlay.
const TITLE_TONE: Record<NonNullable<AnalysisLogPanelProps['activityStatus']>, string> = {
    queued: 'text-muted',
    running: 'text-accent',
    completed: 'text-success',
    failed: 'text-danger'
};

const formatOccurredAt = (value: string): string => {
    const parsed = new Date(value);
    if (!isValid(parsed)) {
        return value;
    }

    return format(parsed, 'HH:mm:ss');
};

const AnalysisLogPanel = ({
    title,
    analysisId,
    timestep,
    active = false,
    live = false,
    activityStatus
}: AnalysisLogPanelProps) => {
    const {
        isLoading,
        error,
        segments
    } = useAnalysisFrameLog({
        analysisId,
        timestep,
        active,
        live
    });
    const scrollRef = useRef<HTMLDivElement | null>(null);
    const [autoFollow, setAutoFollow] = useState(true);
    // What the frame's plugin says about how far it is, while it runs.
    const reportedProgress = useFrameJobProgress(analysisId, timestep);
    const progress = activityStatus === 'running' ? reportedProgress : null;
    const progressLabel = progress
        ? [progress.value !== undefined ? formatProgressPercent(progress.value) : undefined, progress.text].filter(Boolean).join(' · ')
        : '';
    // A run whose analysis the trajectory does not list yet has no title, and still shows how far it is.
    const showHeader = Boolean(title) || progress !== null;

    useEffect(() => {
        const element = scrollRef.current;
        if (!element) {
            return;
        }

        const handleScroll = () => {
            const threshold = 24;
            const isNearBottom = element.scrollHeight - element.scrollTop - element.clientHeight <= threshold;
            setAutoFollow(isNearBottom);
        };

        handleScroll();
        element.addEventListener('scroll', handleScroll);

        return () => {
            element.removeEventListener('scroll', handleScroll);
        };
    }, []);

    useEffect(() => {
        if (!autoFollow) {
            return;
        }

        const element = scrollRef.current;
        if (!element) {
            return;
        }

        element.scrollTop = element.scrollHeight;
    }, [autoFollow, segments]);

    const helperText = useMemo(() => {
        if (error) {
            return error;
        }

        if (isLoading && segments.length === 0) {
            return 'Loading execution log...';
        }

        if (segments.length > 0) {
            return null;
        }

        if (live || activityStatus === 'running') {
            return 'Waiting for plugin output...';
        }

        if (activityStatus === 'queued') {
            return 'Frame is queued for execution.';
        }

        return 'No execution output was captured for this frame.';
    }, [activityStatus, error, isLoading, live, segments.length]);

    return (
        <div className='relative flex h-full min-h-0 flex-1 flex-col'>
            {showHeader && (
                <div className='pointer-events-none absolute inset-x-0 top-0 z-[1] flex h-8 flex-row items-center gap-2 bg-canvas/[0.88] px-4 text-xs'>
                    {title && (
                        <span className={cn('truncate font-medium', activityStatus ? TITLE_TONE[activityStatus] : 'text-foreground')}>
                            {title}
                        </span>
                    )}
                    {title && activityStatus && <span className='sr-only'>{activityStatus}</span>}
                    {title && timestep !== undefined && <span className='shrink-0 text-muted'>Frame {timestep}</span>}
                    {progress && (
                        <span className='ml-auto flex min-w-0 items-center gap-2 text-muted'>
                            <span className='truncate tabular-nums'>{progressLabel}</span>
                            <JobProgressBar className='w-16 shrink-0' value={progress.value} label={`${title ?? 'Analysis'} progress`} />
                        </span>
                    )}
                </div>
            )}
            <Scrollable className='min-h-0 flex-1' ref={scrollRef}>
                {helperText ? (
                    <div className='flex min-h-0 flex-1 flex-row items-center justify-center p-4'>
                        <p className='text-xs text-muted'>{helperText}</p>
                    </div>
                ) : (
                    <pre className={cn(
                        'm-0 whitespace-pre-wrap break-words px-4 pb-4 font-mono text-xs leading-[1.55] text-foreground',
                        showHeader ? 'pt-9' : 'pt-3.5'
                    )}>
                        {segments.map((segment, index) => (
                            <span
                                key={`${segment.occurredAt}-${index}`}
                                data-stream={segment.stream}
                                title={formatOccurredAt(segment.occurredAt)}
                            >
                                {segment.text}
                            </span>
                        ))}
                    </pre>
                )}
            </Scrollable>
        </div>
    );
};

export default AnalysisLogPanel;
