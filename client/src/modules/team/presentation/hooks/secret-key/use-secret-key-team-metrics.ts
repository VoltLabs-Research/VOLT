import { useCallback } from 'react';
import useSecretKeyUseCases from './use-secret-key-repository';
import { useTeamStore } from '@/modules/team/presentation/stores/use-team-store';
import usePollingFetch from '@/shared/presentation/hooks/use-polling-fetch';
import type { TeamUsageMetrics } from '@/modules/team/domain/entities';

const POLL_INTERVAL = 60_000;

const useSecretKeyTeamMetrics = (days: number = 30) => {
    const { secretKeyRepository } = useSecretKeyUseCases();
    const selectedTeam = useTeamStore((state) => state.selectedTeam);

    const fetcher = useCallback(
        () => secretKeyRepository.getTeamMetrics(selectedTeam!._id, { days }),
        [secretKeyRepository, selectedTeam?._id, days]
    );

    const { data: metrics, isLoading, error, refetch } = usePollingFetch<TeamUsageMetrics>(
        fetcher,
        POLL_INTERVAL,
        !!selectedTeam?._id
    );

    return { metrics, isLoading, error, refetch };
};

export default useSecretKeyTeamMetrics;
