import { useSecretKeyUsageQuery } from '@/modules/team/hooks/secret-key/queries';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import { SECRET_KEY_METRICS_POLL_INTERVAL } from '@/modules/team/hooks/secret-key/constants';

export default function useSecretKeyUsage(secretKeyId: string | undefined, days: number = 30) {
    const selectedTeamId = useSelectedTeamId();

    const query = useSecretKeyUsageQuery(
        {
            teamId: selectedTeamId ?? '',
            secretKeyId: secretKeyId ?? '',
            days
        },
        {
            enabled: !!selectedTeamId && !!secretKeyId,
            refetchInterval: SECRET_KEY_METRICS_POLL_INTERVAL
        }
    );

    return {
        usage: query.data,
        isLoading: query.isLoading,
        error: query.error,
        refetch: query.refetch
    };
}
