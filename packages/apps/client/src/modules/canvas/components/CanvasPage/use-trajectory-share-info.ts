import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import useTeamAccess from '@/modules/team/hooks/team/use-team-access';
import { useMemo } from 'react';

import type { Trajectory } from '@volt/contracts/modules/trajectory/domain';
import { TeamAccess, TeamArea } from '@volt/contracts/modules/team/access';

const useTrajectoryShareInfo = (trajectory: Trajectory | null) => {
    const selectedTeamId = useSelectedTeamId();
    const { can } = useTeamAccess();

    return useMemo(() => {
        if (!trajectory?._id) {
            return undefined;
        }

        const teamId = typeof trajectory.team === 'string' ? trajectory.team : trajectory.team._id;
        const isTeamOwner = Boolean(selectedTeamId && selectedTeamId === teamId);

        return {
            trajectoryId: trajectory._id,
            isPublic: Boolean(trajectory.isPublic),
            canManageVisibility: isTeamOwner && can(TeamArea.Trajectory, TeamAccess.Write)
        };
    }, [can, selectedTeamId, trajectory?._id, trajectory?.isPublic, trajectory?.team]);
};

export default useTrajectoryShareInfo;
