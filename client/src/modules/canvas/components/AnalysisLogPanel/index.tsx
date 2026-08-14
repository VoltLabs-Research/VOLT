import useAnalysisFrameLog from '@/modules/canvas/hooks/use-analysis-frame-log';
import { format, isValid } from 'date-fns';
import { useEffect, useMemo, useRef, useState } from 'react';
import Scrollable from '@/shared/ui/components/Scrollable';

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
            <Scrollable className='min-h-0 flex-1 bg-surface' ref={scrollRef}>
                {helperText ? (
                    <div className='flex min-h-0 flex-1 flex-row items-center justify-center p-4'>
                        <p className='text-xs text-muted'>{helperText}</p>
                    </div>
                ) : (
                    <pre className='m-0 whitespace-pre-wrap break-words px-4 pb-4 pt-3.5 font-mono text-xs leading-[1.55] text-foreground'>
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
