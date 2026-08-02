import { useTeamPermissionsQuery } from '@/modules/team/hooks/team/queries';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import { canAccessByPermissions } from '@/modules/team/utils/team/permission-evaluator';
import type { PermissionMode } from '@/modules/team/utils/team/permission-evaluator';

export default function useTeamPermissions() {
    const selectedTeamId = useSelectedTeamId();

    const permissionsQuery = useTeamPermissionsQuery(selectedTeamId ?? '', {
        enabled: !!selectedTeamId
    });

    const permissions = permissionsQuery.data ?? [];
    const permissionsTeamId = permissionsQuery.data ? selectedTeamId : null;
    const isScopeReady = !!selectedTeamId && permissionsTeamId === selectedTeamId;
    const scopedPermissions = isScopeReady ? permissions : [];

    const canAccess = (requiredPermissions: string[] = [], mode: PermissionMode = 'any'): boolean => {
        return canAccessByPermissions(scopedPermissions, requiredPermissions, mode);
    };

    return {
        selectedTeamId,
        permissions,
        permissionsTeamId,
        scopedPermissions,
        isLoading: permissionsQuery.isLoading || permissionsQuery.isFetching,
        isScopeReady,
        canAccess
    };
}
