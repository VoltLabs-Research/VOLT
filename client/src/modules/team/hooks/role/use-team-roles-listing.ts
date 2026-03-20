import { teamRolesResource } from '@/modules/team/hooks/role/queries';
import { useMemo } from 'react';
import type { GetTeamRolesParams } from '@/modules/team/api/dtos/role/get-team-roles';

export default function useTeamRolesListing(teamId?: string | null) {
    const { queryKey, fetchData } = useMemo(
        () => teamRolesResource.createListingAccessors<GetTeamRolesParams>(teamId),
        [teamId]
    );

    return {
        queryKey,
        fetchData
    };
}
