import { useState, useEffect, useCallback, useRef } from 'react';
import useSecretKeyUseCases from './use-secret-key-use-cases';
import { useTeamStore } from '@/modules/team/presentation/stores/use-team-store';
import type { KeyUsageMetrics } from '@/modules/team/domain/entities';

const POLL_INTERVAL = 60_000;

const useSecretKeyUsage = (secretKeyId: string | undefined, days: number = 30) => {
    const { secretKeyRepository } = useSecretKeyUseCases();
    const selectedTeam = useTeamStore((state) => state.selectedTeam);
    const [usage, setUsage] = useState<KeyUsageMetrics | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const fetchUsage = useCallback(async () => {
        if (!selectedTeam?._id || !secretKeyId) return;
        try {
            const data = await secretKeyRepository.getKeyUsage(selectedTeam._id, secretKeyId, { days });
            setUsage(data);
        } catch {
            setUsage(null);
        } finally {
            setIsLoading(false);
        }
    }, [secretKeyRepository, selectedTeam?._id, secretKeyId, days]);

    useEffect(() => {
        setIsLoading(true);
        fetchUsage();

        intervalRef.current = setInterval(fetchUsage, POLL_INTERVAL);
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [fetchUsage]);

    return { usage, isLoading, refetch: fetchUsage };
};

export default useSecretKeyUsage;
