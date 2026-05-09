import { useCallback, useEffect, useState } from 'react';

export interface DemoCountdownSnapshot {
    minutes: number;
    seconds: number;
    totalMs: number;
    expired: boolean;
}

export const useDemoClusterCountdown = (expiresAt: Date | null | undefined): DemoCountdownSnapshot => {
    const expiresAtMs = expiresAt?.getTime();

    const compute = useCallback((): DemoCountdownSnapshot => {
        if (expiresAtMs === undefined) {
            return { minutes: 0, seconds: 0, totalMs: 0, expired: true };
        }
        const totalMs = Math.max(0, expiresAtMs - Date.now());
        const totalSeconds = Math.floor(totalMs / 1000);
        return {
            minutes: Math.floor(totalSeconds / 60),
            seconds: totalSeconds % 60,
            totalMs,
            expired: totalMs === 0
        };
    }, [expiresAtMs]);

    const [snapshot, setSnapshot] = useState<DemoCountdownSnapshot>(compute);

    useEffect(() => {
        setSnapshot(compute());
        if (expiresAtMs === undefined) return;

        const tick = () => setSnapshot(compute());
        const id = window.setInterval(tick, 1000);
        return () => window.clearInterval(id);
    }, [compute, expiresAtMs]);

    return snapshot;
};
