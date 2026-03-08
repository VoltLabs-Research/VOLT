import { useSecretKeyUsageQuery } from '@/modules/team/hooks/secret-key/queries';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';

const POLL_INTERVAL = 60_000;

const useSecretKeyUsage = (secretKeyId: string | undefined, days: number = 30) => {
    const selectedTeamId = useSelectedTeamId();

    const isEnabled = !!selectedTeamId && !!secretKeyId;

    const query = useSecretKeyUsageQuery(
        {
            teamId: selectedTeamId ?? '',
            secretKeyId: secretKeyId ?? '',
            days
        },
        {
            enabled: isEnabled,
            refetchInterval: POLL_INTERVAL
        }
    );

    return {
        usage: query.data,
        isLoading: query.isLoading,
        error: query.error,
        refetch: query.refetch
    };
};

export default useSecretKeyUsage;
