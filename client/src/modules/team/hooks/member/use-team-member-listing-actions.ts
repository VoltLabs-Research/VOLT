import useChatActions from '@/modules/chat/hooks/chat/use-chat-actions';
import { useRemoveTeamMemberMutation, useUpdateTeamMemberMutation } from '@/modules/team/hooks/member/queries';
import { useUpdateTeamMutation } from '@/modules/team/hooks/team/queries';
import useLeaveTeam from '@/modules/team/hooks/team/use-leave-team';
import { runAction } from '@/shared/ui/actions/run-action';
import { confirm, ConfirmActionTone } from '@/shared/ui/hooks/use-confirm';
import useListingActions from '@/shared/ui/hooks/use-listing-actions';
import { createPromiseToastOptions } from '@/shared/ui/utils/toast-options';
import { IoChatbubbleOutline, IoExitOutline, IoPersonRemoveOutline } from 'react-icons/io5';
import { useCallback } from 'react';
import type { Team, TeamMemberStats } from '@volt/contracts/modules/team/domain';

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
    canInvite: boolean;
}

export default function useTeamMemberListingActions({
    selectedTeam,
    currentUserId,
    canInvite
}: UseTeamMemberListingActionsOptions) {
    const chatActions = useChatActions();
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

    const handleRoleChange = useCallback(async (memberId: string, roleId: string) => {
        await runAction({
            action: () => updateTeamMemberMutation.mutateAsync({
                teamId: selectedTeam._id,
                memberId,
                role: roleId
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
            message: {
                label: 'Message',
                icon: IoChatbubbleOutline,
                handler: async ({ item: member }) => {
                    await chatActions.getOrCreateChat(selectedTeam._id, member.user._id);
                }
            },
            delete: {
                label: 'Remove from Team',
                icon: IoPersonRemoveOutline,
                variant: 'danger',
                handler: ({ item, selectedItems }) => {
                    const targets = selectedItems.length > 1 ? selectedItems : [item];
                    return handleRemoveMembers(targets);
                },
                requiredPermission: canInvite ? undefined : 'team-invitation:create'
            },
            leave: {
                label: LEAVE_TEAM_LABEL,
                icon: IoExitOutline,
                variant: 'danger',
                scope: 'item',
                handler: () => leaveTeam(selectedTeam._id, selectedTeam.name)
            }
        }
    });

    const getTeamMemberMenuOptions = useCallback((member: TeamMemberStats, selectedMembers: TeamMemberStats[]) => {
        if (!canInvite && selectedMembers.length > 1) {
            return [];
        }

        if (selectedMembers.length > 1) {
            return getSelectionActionOptions(member, selectedMembers)
                .filter((option) => option.label !== LEAVE_TEAM_LABEL);
        }

        const options = getMenuOptions(member, selectedMembers);
        const isSelf = currentUserId === member.user._id;

        return options.filter((option) => (option.label === LEAVE_TEAM_LABEL) === isSelf);
    }, [canInvite, currentUserId, getMenuOptions, getSelectionActionOptions]);

    return {
        handleSaveTeamName,
        handleRoleChange,
        getTeamMemberMenuOptions
    };
}
