import { useMemo } from 'react';
import { useTeamPermissionsQuery } from '@/modules/team/hooks/team/queries';
import { getScopedPermissions, isPermissionScopeReady, canAccessByPermissions, type PermissionMode } from '@/modules/team/utilities/permission-evaluator';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';

const useTeamPermissions = () => {
    const selectedTeamId = useSelectedTeamId();

    const permissionsQuery = useTeamPermissionsQuery(selectedTeamId ?? '', {
        enabled: !!selectedTeamId
    });

    const permissions = permissionsQuery.data ?? [];
    const permissionsTeamId = permissionsQuery.data ? selectedTeamId : null;

    const scopedPermissions = useMemo(() => getScopedPermissions({
        selectedTeamId,
        permissionsTeamId,
        permissions
    }), [selectedTeamId, permissionsTeamId, permissions]);

    const canAccess = (requiredPermissions: string[] = [], mode: PermissionMode = 'any'): boolean => {
        return canAccessByPermissions(scopedPermissions, requiredPermissions, mode);
    };

    return {
        selectedTeamId,
        permissions,
        permissionsTeamId,
        scopedPermissions,
        isLoading: permissionsQuery.isLoading || permissionsQuery.isFetching,
        isScopeReady: isPermissionScopeReady({
            selectedTeamId,
            permissionsTeamId
        }),
        canAccess
    };
};

export default useTeamPermissions;
