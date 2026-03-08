import { useDeleteSecretKeyMutation } from '@/modules/team/hooks/secret-key/queries';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';

export default function useDeleteSecretKey() {
    const selectedTeamId = useSelectedTeamId();
    const deleteSecretKey = useDeleteSecretKeyMutation();

    const handleDelete = async (secretKeyId: string) => {
        if (!selectedTeamId) return;
        await deleteSecretKey.mutateAsync({
            teamId: selectedTeamId,
            secretKeyId
        });
    };

    return handleDelete;
}
