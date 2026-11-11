import { useCallback } from 'react';
import { useTeamRoleQuery } from '@/modules/team/hooks/team/queries';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import { meetsTeamAccess } from '@/modules/team/utils/team/team-access';
import type { TeamAccessRequirement } from '@/modules/team/utils/team/team-access';
import { canAccessTeamArea, type TeamAccess, type TeamArea, type TeamRole } from '@volt/contracts/modules/team/access';

// The user's role in the selected team and what it lets them do there. Until the role of the
// selected team has loaded, the role is null and nothing is allowed.
export default function useTeamAccess() {
    const selectedTeamId = useSelectedTeamId();

    const roleQuery = useTeamRoleQuery(selectedTeamId ?? '', {
        enabled: !!selectedTeamId
    });

    const isScopeReady = !!selectedTeamId && roleQuery.data !== undefined;
    const role: TeamRole | null = isScopeReady ? roleQuery.data ?? null : null;

    const can = useCallback(
        (area: TeamArea, access: TeamAccess): boolean => canAccessTeamArea(role, area, access),
        [role]
    );

    const meets = useCallback(
        (requirements: readonly TeamAccessRequirement[] = []): boolean => meetsTeamAccess(role, requirements),
        [role]
    );

    return {
        role,
        isLoading: roleQuery.isLoading || roleQuery.isFetching,
        isScopeReady,
        can,
        meets
    };
}
