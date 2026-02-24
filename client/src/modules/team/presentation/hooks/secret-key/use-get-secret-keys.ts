import { useCallback } from 'react';
import useSecretKeyUseCases from './use-secret-key-use-cases';
import type { PaginationParams } from '@/shared/presentation/hooks/use-pagination-params';
import { useTeamStore } from '@/modules/team/presentation/stores/use-team-store';

const useGetSecretKeys = () => {
    const { secretKeyRepository } = useSecretKeyUseCases();
    const selectedTeam = useTeamStore((state) => state.selectedTeam);

    return useCallback(async (params: PaginationParams) => {
        if (!selectedTeam?._id) {
            throw new Error('No team selected');
        }
        return await secretKeyRepository.listByTeamId(selectedTeam._id, params);
    }, [secretKeyRepository, selectedTeam?._id]);
};

export default useGetSecretKeys;
