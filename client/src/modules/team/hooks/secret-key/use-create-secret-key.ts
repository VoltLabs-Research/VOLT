import { useCreateSecretKeyMutation } from '@/modules/team/hooks/secret-key/queries';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';

const useCreateSecretKey = () => {
    const selectedTeamId = useSelectedTeamId();
    const mutation = useCreateSecretKeyMutation();

    const handleCreate = async (name: string, roleId: string) => {
        if (!selectedTeamId) return;
        return await mutation.mutateAsync({
            teamId: selectedTeamId,
            name,
            roleId
        });
    };

    return { create: handleCreate, isPending: mutation.isPending };
};

export default useCreateSecretKey;
