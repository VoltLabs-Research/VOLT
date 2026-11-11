import { useRemoveTeamMemberMutation, useUpdateTeamMemberMutation } from '@/modules/team/hooks/member/queries';
import { useUpdateTeamMutation } from '@/modules/team/hooks/team/queries';
import useLeaveTeam from '@/modules/team/hooks/team/use-leave-team';
import { runAction } from '@/shared/ui/actions/run-action';
import { confirm, ConfirmActionTone } from '@/shared/ui/hooks/use-confirm';
import useListingActions from '@/shared/ui/hooks/use-listing-actions';
import { createPromiseToastOptions } from '@/shared/ui/utils/toast-options';
import { LogOut, UserMinus } from 'lucide-react';
import { useCallback } from 'react';
import type { Team, TeamMemberStats } from '@volt/contracts/modules/team/domain';
import { TeamArea, hasTeamRole, type TeamRole } from '@volt/contracts/modules/team/access';
import { writeAccess } from '@/modules/team/utils/team/team-access';

const LEAVE_TEAM_LABEL = 'Leave team';

const updateTeamNameToastOptions = createPromiseToastOptions({
    loading: 'Updating team name...',
    success: 'Team name updated',
    error: 'Failed to update team name'
});

const updateRoleToastOptions = createPromiseToastOptions({
    loading: 'Updating role...',
    success: 'Member role updated',
    error: 'Failed to update role'
});

const getRemoveMemberToastOptions = (member: TeamMemberStats) => createPromiseToastOptions({
    loading: `Removing ${member.user.firstName}...`,
    success: `${member.user.firstName} removed from team`,
    error: `Failed to remove ${member.user.firstName}`
});

interface UseTeamMemberListingActionsOptions {
    selectedTeam: Team;
    currentUserId?: string;
    actorRole: TeamRole | null;
    canManageMembers: boolean;
}

export default function useTeamMemberListingActions({
    selectedTeam,
    currentUserId,
    actorRole,
    canManageMembers
}: UseTeamMemberListingActionsOptions) {
    const updateTeamMutation = useUpdateTeamMutation();
    const updateTeamMemberMutation = useUpdateTeamMemberMutation();
    const removeTeamMemberMutation = useRemoveTeamMemberMutation();
    const leaveTeam = useLeaveTeam();

    const handleSaveTeamName = useCallback(async (newName: string) => {
        await runAction({
            action: () => updateTeamMutation.mutateAsync({
                teamId: selectedTeam._id,
                name: newName
            }),
            toast: updateTeamNameToastOptions
        });
    }, [selectedTeam._id, updateTeamMutation]);

    const handleRoleChange = useCallback(async (memberId: string, role: TeamRole) => {
        await runAction({
            action: () => updateTeamMemberMutation.mutateAsync({
                teamId: selectedTeam._id,
                teamMemberId: memberId,
                role
            }),
            toast: updateRoleToastOptions
        });
    }, [selectedTeam._id, updateTeamMemberMutation]);

    const handleRemoveMembers = useCallback(async (members: TeamMemberStats[]) => {
        if (!members.length) return;

        const isConfirmed = await confirm({
            title: members.length === 1
                ? `Remove ${members[0].user.firstName} from this team?`
                : `Remove ${members.length} team members?`,
            description: 'This immediately removes access to the team and cannot be undone.',
            confirmText: 'Remove member',
            cancelText: 'Cancel',
            tone: ConfirmActionTone.Danger
        });
        if (!isConfirmed) return;

        for (const member of members) {
            await runAction({
                action: () => removeTeamMemberMutation.mutateAsync({
                    teamId: selectedTeam._id,
                    memberId: member._id
                }),
                toast: getRemoveMemberToastOptions(member)
            });
        }
    }, [selectedTeam._id, removeTeamMemberMutation]);

    const { getMenuOptions, getSelectionActionOptions } = useListingActions<TeamMemberStats>({
        actions: {
            delete: {
                label: 'Remove from Team',
                icon: UserMinus,
                variant: 'danger',
                handler: ({ item, selectedItems }) => {
                    const targets = selectedItems.length > 1 ? selectedItems : [item];
                    return handleRemoveMembers(targets);
                },
                requiredAccess: writeAccess(TeamArea.TeamMember)
            },
            leave: {
                label: LEAVE_TEAM_LABEL,
                icon: LogOut,
                variant: 'danger',
                scope: 'item',
                handler: () => leaveTeam(selectedTeam._id, selectedTeam.name)
            }
        }
    });

    const getTeamMemberMenuOptions = useCallback((member: TeamMemberStats, selectedMembers: TeamMemberStats[]) => {
        if (!canManageMembers && selectedMembers.length > 1) {
            return [];
        }

        // Nobody removes a member who ranks above them.
        if (selectedMembers.length > 1) {
            if (selectedMembers.some((selected) => !hasTeamRole(actorRole, selected.role))) return [];

            return getSelectionActionOptions(member, selectedMembers)
                .filter((option) => option.label !== LEAVE_TEAM_LABEL);
        }

        const options = getMenuOptions(member, selectedMembers);
        const isSelf = currentUserId === member.user._id;
        if (!isSelf && !hasTeamRole(actorRole, member.role)) return [];

        return options.filter((option) => (option.label === LEAVE_TEAM_LABEL) === isSelf);
    }, [actorRole, canManageMembers, currentUserId, getMenuOptions, getSelectionActionOptions]);

    return {
        handleSaveTeamName,
        handleRoleChange,
        getTeamMemberMenuOptions
    };
}
