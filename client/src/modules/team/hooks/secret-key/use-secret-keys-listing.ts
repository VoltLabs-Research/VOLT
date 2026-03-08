import { useCallback, useMemo } from 'react';
import { fetchSecretKeys, SECRET_KEY_QUERY_KEYS } from '@/modules/team/hooks/secret-key/queries';
import type { PaginationParams } from '@/shared/presentation/hooks/use-pagination-params';

const useSecretKeysListing = (teamId?: string | null) => {
    const queryKey = useMemo(() => SECRET_KEY_QUERY_KEYS.secretKeysListing(teamId ?? ''), [teamId]);

    const fetchData = useCallback(async (params: PaginationParams) => {
        if (!teamId) {
            throw new Error('No team selected');
        }

        return fetchSecretKeys({
            teamId,
            ...params
        });
    }, [teamId]);

    return {
        queryKey,
        fetchData
    };
};

export default useSecretKeysListing;
