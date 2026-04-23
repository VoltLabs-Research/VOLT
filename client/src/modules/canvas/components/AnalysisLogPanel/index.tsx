import useAnalysisFrameLog from '@/modules/canvas/hooks/use-analysis-frame-log';
import { Box, Stack, Row, Text } from '@/shared/presentation/primitives';
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
        <Stack flex='1' minH='0' className='canvas-analysis-log-panel'>
            <Box ref={scrollRef} overflow='y-auto' flex='1' minH='0' className='canvas-analysis-log-stream'>
                {helperText ? (
                    <Row justify='center' flex='1' minH='0' className='canvas-analysis-log-empty'>
                        <Text as='p' size='sm' tone='secondary'>{helperText}</Text>
                    </Row>
                ) : (
                    <pre className='canvas-analysis-log-terminal font-mono m-0'>
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
            </Box>
        </Stack>
    );
};

export default AnalysisLogPanel;
