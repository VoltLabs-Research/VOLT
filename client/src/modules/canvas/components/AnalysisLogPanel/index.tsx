import useAnalysisFrameLog from '@/modules/canvas/hooks/use-analysis-frame-log';
import { format, isValid } from 'date-fns';
import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * `.canvas-analysis-log-stream`. `--color-surface-0` / `-1` are `--surface` and
 * `--surface-secondary`; the two `color-mix` stops stay literal because the gradient is
 * the point.
 */
const LOG_STREAM_CLASS = 'min-h-0 flex-1 overflow-y-auto bg-[linear-gradient(180deg,color-mix(in_srgb,var(--surface)_86%,transparent)_0%,color-mix(in_srgb,var(--surface-secondary)_92%,transparent)_100%)]';

/** `.canvas-analysis-log-terminal` */
const LOG_TERMINAL_CLASS = 'm-0 whitespace-pre-wrap break-words px-4 pb-[1.1rem] pt-[0.85rem] font-mono text-[0.72rem] leading-[1.55] text-foreground';

interface AnalysisLogPanelProps {
    analysisId?: string;
    timestep?: number;
    active?: boolean;
    live?: boolean;
    activityStatus?: 'queued' | 'running' | 'completed' | 'failed';
}

const formatOccurredAt = (value: string): string => {
    const parsed = new Date(value);
    if (!isValid(parsed)) {
        return value;
    }

    return format(parsed, 'HH:mm:ss');
};

const AnalysisLogPanel = ({
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

        if (isLoading) {
            return 'Loading execution log...';
        }

        if (activityStatus === 'queued') {
            return 'Frame is queued for execution.';
        }

        if (live && segments.length === 0) {
            return 'Waiting for plugin output...';
        }

        if (segments.length === 0) {
            return 'No execution output was captured for this frame.';
        }

        return null;
    }, [activityStatus, error, isLoading, live, segments.length]);

    return (
        <div className='flex h-full min-h-0 flex-1 flex-col'>
            <div className={LOG_STREAM_CLASS} ref={scrollRef}>
                {helperText ? (
                    <div className='flex min-h-0 flex-1 flex-row items-center justify-center p-4'>
                        <p className='text-xs text-muted'>{helperText}</p>
                    </div>
                ) : (
                    <pre className={LOG_TERMINAL_CLASS}>
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
            </div>
        </div>
    );
};

export default AnalysisLogPanel;
