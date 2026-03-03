import { useState, useEffect, useCallback, useRef } from 'react';
import useSecretKeyUseCases from './use-secret-key-use-cases';
import { useTeamStore } from '@/modules/team/presentation/stores/use-team-store';
import type { TeamUsageMetrics } from '@/modules/team/domain/entities';

const POLL_INTERVAL = 60_000;

const useSecretKeyTeamMetrics = (days: number = 30) => {
    const { secretKeyRepository } = useSecretKeyUseCases();
    const selectedTeam = useTeamStore((state) => state.selectedTeam);
    const [metrics, setMetrics] = useState<TeamUsageMetrics | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const fetchMetrics = useCallback(async () => {
        if (!selectedTeam?._id) return;
        try {
            const data = await secretKeyRepository.getTeamMetrics(selectedTeam._id, { days });
            setMetrics(data);
        } catch {
            setMetrics(null);
        } finally {
            setIsLoading(false);
        }
    }, [secretKeyRepository, selectedTeam?._id, days]);

    useEffect(() => {
        setIsLoading(true);
        fetchMetrics();

        intervalRef.current = setInterval(fetchMetrics, POLL_INTERVAL);
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [fetchMetrics]);

    return { metrics, isLoading, refetch: fetchMetrics };
};

export default useSecretKeyTeamMetrics;
