import { useMemo } from 'react';
import { useTeamStore } from '@/modules/team/presentation/stores/use-team-store';
import { canAccessTeamPermissions } from '@/modules/team/presentation/utils/permission-evaluator';

type PermissionMode = 'any' | 'all';

const usePermission = (requiredPermissions: string[], mode?: PermissionMode): boolean => {
    const selectedTeamId = useTeamStore((state) => state.selectedTeam?._id ?? null);
    const teamPermissions = useTeamStore((state) => state.permissions);
    const permissionsTeamId = useTeamStore((state) => state.permissionsTeamId);

    return useMemo(() => canAccessTeamPermissions({
        selectedTeamId,
        permissionsTeamId,
        permissions: teamPermissions,
        requiredPermissions,
        mode
    }), [selectedTeamId, permissionsTeamId, teamPermissions, requiredPermissions, mode]);
};

export default usePermission;
