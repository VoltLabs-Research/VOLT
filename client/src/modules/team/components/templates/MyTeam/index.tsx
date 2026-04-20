import { useCurrentUser } from '@/modules/auth/hooks/use-current-user';
import useChatActions from '@/modules/chat/hooks/chat/use-chat-actions';
import { useRemoveTeamMemberMutation, useUpdateTeamMemberMutation } from '@/modules/team/hooks/member/queries';
import { useSelectedTeam } from '@/modules/team/hooks/team/use-selected-team';
import { useUpdateTeamMutation } from '@/modules/team/hooks/team/queries';
import { useTeamPresenceStore } from '@/modules/team/stores/team/use-team-presence-store';
import { resolveTeamUserOnline } from '@/modules/team/utilities/member/presence';
import { runAction } from '@/shared/presentation/actions/run-action';
import { confirm, ConfirmActionTone } from '@/shared/presentation/hooks/use-confirm';
import ActivityHeatmap from '@/modules/daily-activity/components/molecules/ActivityHeatmap';
import ListingUserCell from '@/shared/presentation/components/ListingUserCell';
import useDailyActivityData from '@/modules/daily-activity/hooks/use-daily-activity-data';
import useTeamMembersListing from '@/modules/team/hooks/member/use-team-members-listing';
import useTeamPermissions from '@/modules/team/hooks/team/use-team-permissions';
import useTeamRoleData from '@/modules/team/hooks/role/use-team-role-data';
import Container from '@/shared/presentation/components/Container';
import DocumentListing from '@/shared/presentation/components/DocumentListing';
import EditableTag from '@/shared/presentation/components/EditableTag';
import Select from '@/shared/presentation/components/Select';
import StatusBadge from '@/shared/presentation/components/StatusBadge';
import useListingActions from '@/shared/presentation/hooks/use-listing-actions';
import { dateColumn } from '@/shared/presentation/utilities/column-presets';
import { createPromiseToastOptions } from '@/shared/presentation/toast-options';
import { formatDistanceToNow } from 'date-fns';
import { IoChatbubbleOutline, IoPersonRemoveOutline } from 'react-icons/io5';
import { useCallback, useMemo } from 'react';
import type { TeamMemberStats } from '@/modules/team/api/entities/member/team-member';
import type { ColumnConfig, SocketInvalidationConfig } from '@/shared/presentation/components/DocumentListing';
import './MyTeam.css';

const TEAM_MEMBERS_QUERY_KEY = ['team-members'] as const;

const SOCKET_INVALIDATION: SocketInvalidationConfig[] = [
    { event: 'team-member.created', queryKeys: [TEAM_MEMBERS_QUERY_KEY] },
    { event: 'team-member.deleted', queryKeys: [TEAM_MEMBERS_QUERY_KEY] },
    { event: 'team-member.left', queryKeys: [TEAM_MEMBERS_QUERY_KEY] }
];

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

const formatTrackedMinutes = (minutes: number): string => {
    const totalSeconds = Math.max(0, Math.round(minutes * 60));
    const totalMinutes = Math.floor(totalSeconds / 60);
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;

    if (hours > 0) {
        return `${hours}h ${mins}m`;
    }

    if (totalSeconds > 0 && totalMinutes === 0) {
        return '<1m';
    }

    return `${mins}m`;
};

export default function MyTeamTemplate() {
    const chatActions = useChatActions();

    const currentUser = useCurrentUser();
    const selectedTeam = useSelectedTeam()!;
    const { canAccess } = useTeamPermissions();
    const canInvite = canAccess(['team-invitation:create']);

    const { roles } = useTeamRoleData({ teamId: selectedTeam._id });
    const { queryKey, fetchData } = useTeamMembersListing(selectedTeam._id);
    const onlineUserIds = useTeamPresenceStore((state) => state.onlineUserIds);
    const hasPresenceSnapshot = useTeamPresenceStore((state) => state.hasPresenceSnapshot);

    const updateTeamMutation = useUpdateTeamMutation();
    const updateTeamMemberMutation = useUpdateTeamMemberMutation();
    const removeTeamMemberMutation = useRemoveTeamMemberMutation();
    const { activityData } = useDailyActivityData();

    const handleSaveTeamName = useCallback(async (newName: string) => {
        await runAction({
            action: () => updateTeamMutation.mutateAsync({ teamId: selectedTeam._id, name: newName }),
            toast: updateTeamNameToastOptions
        });
    }, [selectedTeam._id, updateTeamMutation]);

    const handleRoleChange = useCallback(async (memberId: string, roleId: string) => {
        await runAction({
            action: () => updateTeamMemberMutation.mutateAsync({ teamId: selectedTeam._id, memberId, role: roleId }),
            toast: updateRoleToastOptions
        });
    }, [selectedTeam._id, updateTeamMemberMutation]);

    const handleRemoveMembers = useCallback(async (members: TeamMemberStats[]) => {
        if (!members.length) return;

        let confirmationTitle = `Remove ${members.length} team members?`;
        if (members.length === 1) {
            confirmationTitle = `Remove ${members[0].user.firstName} from this team?`;
        }

        const isConfirmed = await confirm({
            title: confirmationTitle,
            description: 'This immediately removes access to the team and cannot be undone.',
            confirmText: 'Remove member',
            cancelText: 'Cancel',
            tone: ConfirmActionTone.Danger
        });
        if (!isConfirmed) return;

        for (const member of members) {
            await runAction({
                action: () => removeTeamMemberMutation.mutateAsync({ teamId: selectedTeam._id, memberId: member._id }),
                toast: getRemoveMemberToastOptions(member)
            });
        }
    }, [selectedTeam._id, removeTeamMemberMutation, confirm]);

    const roleOptions = useMemo(() => {
        return roles.map((role) => ({
            value: role._id,
            title: role.name,
            description: role.isSystem ? 'System role' : `${role.permissions.length} permissions`
        }));
    }, [roles]);

    const headerContent = useMemo(() => {
        return (
            <Container className='d-flex items-center gap-1'>
                {canInvite ? (
                    <EditableTag
                        as='h1'
                        className='font-size-6 font-weight-5 sm:font-size-4 color-primary'
                        onSave={handleSaveTeamName}
                    >
                        {selectedTeam.name}
                    </EditableTag>
                ) : (
                    <h1 className='font-size-6 font-weight-5 sm:font-size-4 color-primary'>{selectedTeam.name}</h1>
                )}
            </Container>
        );
    }, [selectedTeam, canInvite, handleSaveTeamName]);

    const columns: ColumnConfig<TeamMemberStats>[] = useMemo(() => [
        {
            key: 'user',
            title: 'User',
            render: (_value, member) => (
                <ListingUserCell
                    user={member.user}
                    showStatus
                    showCurrentUserSuffix
                />
            )
        },
        {
            key: 'role',
            title: 'Role',
            render: (_value, member) => {
                const isOwner = selectedTeam.owner._id === member.user._id;

                if (isOwner) {
                    return <StatusBadge variant='primary'>Owner</StatusBadge>;
                }

                if (canInvite && currentUser?._id !== member.user._id && roleOptions.length > 0) {
                    return (
                        <Select
                            options={roleOptions}
                            value={member.role._id}
                            onChange={(roleId) => handleRoleChange(member._id, roleId)}
                            placeholder='Select role...'
                            className='role-select-compact'
                        />
                    );
                }

                return <StatusBadge variant='neutral'>{member.role.name}</StatusBadge>;
            }
        },
        {
            key: 'status',
            title: 'Status',
            render: (_value, member) => {
                const lastSeenAt = member.user.lastSeenAt ? new Date(member.user.lastSeenAt) : null;
                const isOnline = resolveTeamUserOnline(member.user, onlineUserIds, hasPresenceSnapshot);

                return isOnline ? (
                    <StatusBadge status='online' size='compact'>Online</StatusBadge>
                ) : (
                    <Container className='d-flex column'>
                        <StatusBadge status='offline' size='compact'>Offline</StatusBadge>
                        <span className='color-muted font-size-2'>
                            {lastSeenAt
                                ? `Seen ${formatDistanceToNow(lastSeenAt)} ago`
                                : 'Last seen unavailable'}
                        </span>
                    </Container>
                );
            }
        },
        {
            key: 'timeSpentLast7Days',
            title: 'Time (7d)',
            render: (_value, member) => {
                return (
                    <span className='color-secondary font-size-2'>
                        {formatTrackedMinutes(member.timeSpentLast7Days)}
                    </span>
                );
            }
        },
        dateColumn<TeamMemberStats>('joinedAt', 'Joined At', { sortable: false, withTitle: true })
    ], [canInvite, currentUser?._id, selectedTeam, roleOptions, handleRoleChange, onlineUserIds, hasPresenceSnapshot]);

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
            }
        }
    });

    const getTeamMemberMenuOptions = useCallback((member: TeamMemberStats, selectedMembers: TeamMemberStats[]) => {
        if (!canInvite && selectedMembers.length > 1) {
            return [];
        }

        return selectedMembers.length > 1
            ? getSelectionActionOptions(member, selectedMembers)
            : getMenuOptions(member, selectedMembers);
    }, [canInvite, getMenuOptions, getSelectionActionOptions]);

    return (
        <Container className='my-team-page h-max'>
            <DocumentListing<TeamMemberStats>
                title={headerContent}
                queryKey={queryKey}
                columns={columns}
                fetchData={fetchData}
                getMenuOptions={getTeamMemberMenuOptions}
                emptyMessage='No members found in this team.'
                headerActions={<ActivityHeatmap data={activityData} />}
                gap=''
                socketInvalidation={SOCKET_INVALIDATION}
            />
        </Container>
    );
};
