import { useCallback } from 'react';
import useSecretKeyUseCases from './use-secret-key-use-cases';
import { useTeamStore } from '@/modules/team/presentation/stores/use-team-store';
import usePollingFetch from '@/shared/presentation/hooks/use-polling-fetch';
import type { KeyUsageMetrics } from '@/modules/team/domain/entities';

const POLL_INTERVAL = 60_000;

const useSecretKeyUsage = (secretKeyId: string | undefined, days: number = 30) => {
    const { secretKeyRepository } = useSecretKeyUseCases();
    const selectedTeam = useTeamStore((state) => state.selectedTeam);

    const fetcher = useCallback(
        () => secretKeyRepository.getKeyUsage(selectedTeam!._id, secretKeyId!, { days }),
        [secretKeyRepository, selectedTeam?._id, secretKeyId, days]
    );

    const { data: usage, isLoading, error, refetch } = usePollingFetch<KeyUsageMetrics>(
        fetcher,
        POLL_INTERVAL,
        !!selectedTeam?._id && !!secretKeyId
    );

    return { usage, isLoading, error, refetch };
};

export default useSecretKeyUsage;
