import { useState, useCallback } from 'react';

interface UseTimeSeriesBufferOptions {
    maxPoints: number;
};

const useTimeSeriesBuffer = <T extends object>(
    options: UseTimeSeriesBufferOptions
) => {
    const { maxPoints } = options;
    const [history, setHistory] = useState<T[]>([]);

    const pushPoint = useCallback((point: T) => {
        setHistory((prev) => {
            const updated = [...prev, point];
            if (updated.length > maxPoints) {
                return updated.slice(updated.length - maxPoints);
            }
            return updated;
        });
    }, [maxPoints]);

    const reset = useCallback(() => {
        setHistory([]);
    }, []);

    return {
        history,
        pushPoint,
        reset
    };
};

export default useTimeSeriesBuffer;
