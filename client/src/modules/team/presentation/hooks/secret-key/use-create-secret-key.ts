import { useCallback } from 'react';
import useSecretKeyUseCases from './use-secret-key-repository';
import { useTeamStore } from '@/modules/team/presentation/stores/use-team-store';

const useCreateSecretKey = () => {
    const { secretKeyRepository } = useSecretKeyUseCases();
    const selectedTeam = useTeamStore((state) => state.selectedTeam);

    return useCallback(async (name: string, roleId: string) => {
        if (!selectedTeam?._id) return;
        return await secretKeyRepository.create(selectedTeam._id, { name, roleId });
    }, [secretKeyRepository, selectedTeam?._id]);
};

export default useCreateSecretKey;
