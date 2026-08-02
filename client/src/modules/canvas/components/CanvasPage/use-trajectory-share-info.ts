import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import useTeamPermissions from '@/modules/team/hooks/team/use-team-permissions';
import { useMemo } from 'react';

import type { Trajectory } from '@volt/contracts/modules/trajectory/domain';

/** Visibility descriptor for the toolbar: only the owning team with update rights may publish. */
const useTrajectoryShareInfo = (trajectory: Trajectory | null) => {
    const selectedTeamId = useSelectedTeamId();
    const { canAccess } = useTeamPermissions();

    return useMemo(() => {
        if (!trajectory?._id) {
            return undefined;
        }

        const teamId = typeof trajectory.team === 'string' ? trajectory.team : trajectory.team._id;
        const isTeamOwner = Boolean(selectedTeamId && selectedTeamId === teamId);

        return {
            trajectoryId: trajectory._id,
            isPublic: Boolean(trajectory.isPublic),
            canManageVisibility: isTeamOwner && canAccess(['trajectory:update'])
        };
    }, [canAccess, selectedTeamId, trajectory?._id, trajectory?.isPublic, trajectory?.team]);
};

export default useTrajectoryShareInfo;
