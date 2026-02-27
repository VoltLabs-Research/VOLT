import { useCallback } from 'react';
import useSecretKeyUseCases from './use-secret-key-use-cases';
import { useTeamStore } from '@/modules/team/presentation/stores/use-team-store';

const useDeleteSecretKey = () => {
    const { secretKeyRepository } = useSecretKeyUseCases();
    const selectedTeam = useTeamStore((state) => state.selectedTeam);

    return useCallback(async (secretKeyId: string) => {
        if (!selectedTeam?._id) return;
        await secretKeyRepository.deleteById(selectedTeam._id, secretKeyId);
    }, [secretKeyRepository, selectedTeam?._id]);
};

export default useDeleteSecretKey;
