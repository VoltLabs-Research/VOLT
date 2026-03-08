import { useRevokeSecretKeyMutation } from '@/modules/team/hooks/secret-key/queries';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';

const useRevokeSecretKey = () => {
    const selectedTeamId = useSelectedTeamId();
    const revokeSecretKey = useRevokeSecretKeyMutation();

    const handleRevoke = async (secretKeyId: string) => {
        if (!selectedTeamId) return;
        await revokeSecretKey.mutateAsync({
            teamId: selectedTeamId,
            secretKeyId
        });
    };

    return handleRevoke;
};

export default useRevokeSecretKey;
