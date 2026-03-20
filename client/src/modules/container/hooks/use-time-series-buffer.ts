import { useCallback, useState } from 'react';

interface UseTimeSeriesBufferOptions {
    maxPoints: number;
};

interface UseTimeSeriesBufferReturn<T> {
    history: T[];
    pushPoint: (point: T) => void;
    reset: () => void;
};

const useTimeSeriesBuffer = <T extends object>(
    options: UseTimeSeriesBufferOptions
): UseTimeSeriesBufferReturn<T> => {
    const { maxPoints } = options;
    const [history, setHistory] = useState<T[]>([]);

    const pushPoint = useCallback((point: T) => {
        setHistory((previousHistory) => {
            const nextHistory = [...previousHistory, point];

            if (nextHistory.length <= maxPoints) {
                return nextHistory;
            }

            return nextHistory.slice(nextHistory.length - maxPoints);
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
