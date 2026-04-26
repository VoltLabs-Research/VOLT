import { useSecretKeyTeamMetricsQuery } from '@/modules/team/hooks/secret-key/queries';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import { SECRET_KEY_METRICS_POLL_INTERVAL } from '@/modules/team/hooks/secret-key/constants';

export default function useSecretKeyTeamMetrics(days: number = 30) {
    const selectedTeamId = useSelectedTeamId();

    const isEnabled = !!selectedTeamId;

    const query = useSecretKeyTeamMetricsQuery(
        {
            teamId: selectedTeamId ?? '',
            days
        },
        {
            enabled: isEnabled,
            refetchInterval: SECRET_KEY_METRICS_POLL_INTERVAL
        }
    );

    return {
        metrics: query.data,
        isLoading: query.isLoading,
        error: query.error,
        refetch: query.refetch
    };
}
