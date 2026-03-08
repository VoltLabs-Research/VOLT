import { useMemo } from 'react';
import useTeamPermissions from '@/modules/team/hooks/team/use-team-permissions';

type PermissionMode = 'any' | 'all';

const usePermission = (requiredPermissions: string[], mode?: PermissionMode): boolean => {
    const { canAccess } = useTeamPermissions();

    return useMemo(() => canAccess(requiredPermissions, mode), [canAccess, requiredPermissions, mode]);
};

export default usePermission;
