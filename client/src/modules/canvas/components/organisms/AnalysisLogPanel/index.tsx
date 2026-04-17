import useAnalysisFrameLog from '@/modules/canvas/hooks/use-analysis-frame-log';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import { format, isValid } from 'date-fns';
import { useEffect, useMemo, useRef, useState } from 'react';

import './AnalysisLogPanel.css';

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
        <Container className='canvas-analysis-log-panel d-flex column flex-1 min-h-0'>
            <Container
                ref={scrollRef}
                className='canvas-analysis-log-stream y-auto scrollbar-thin flex-1 min-h-0'
            >
                {helperText ? (
                    <Container className='canvas-analysis-log-empty d-flex content-center items-center flex-1 min-h-0'>
                        <Paragraph className='font-size-1 color-secondary'>{helperText}</Paragraph>
                    </Container>
                ) : (
                    <pre className='canvas-analysis-log-terminal m-0'>
                        {segments.map((segment, index) => (
                            <span
                                key={`${segment.occurredAt}-${index}`}
                                className={`canvas-analysis-log-terminal-chunk canvas-analysis-log-terminal-chunk--${segment.stream}`}
                                title={formatOccurredAt(segment.occurredAt)}
                            >
                                {segment.text}
                            </span>
                        ))}
                    </pre>
                )}
            </Container>
        </Container>
    );
};

export default AnalysisLogPanel;
