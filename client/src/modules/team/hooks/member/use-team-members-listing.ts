import { teamMembersResource } from '@/modules/team/hooks/member/queries';
import { useMemo } from 'react';
import type { GetTeamMembersParams } from '@/modules/team/api/dtos/member/get-team-members';

export default function useTeamMembersListing(teamId?: string | null) {
    const { queryKey, fetchData } = useMemo(
        () => teamMembersResource.createListingAccessors<GetTeamMembersParams>(teamId),
        [teamId]
    );

    return {
        queryKey,
        fetchData
    };
}
