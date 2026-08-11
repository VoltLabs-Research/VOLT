import { useCallback, useState } from 'react';

const useTimeSeriesBuffer = (maxPoints: number) => {
    const [history, setHistory] = useState<number[]>([]);

    const pushPoint = useCallback((point: number) => {
        setHistory((previousHistory) => {
            const nextHistory = [...previousHistory, point];

            if (nextHistory.length <= maxPoints) {
                return nextHistory;
            }

            return nextHistory.slice(nextHistory.length - maxPoints);
        });
    }, [maxPoints]);

    return {
        history,
        pushPoint
    };
};

export default useTimeSeriesBuffer;
