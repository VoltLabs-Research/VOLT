import { Box, Heading, Row, Stack, StatusBadge, Text, Select } from '@voltstack/bravais';
import { useCurrentUser } from '@/modules/auth/hooks/use-current-user';
import useChatActions from '@/modules/chat/hooks/chat/use-chat-actions';
import { useRemoveTeamMemberMutation, useUpdateTeamMemberMutation } from '@/modules/team/hooks/member/queries';
import { useSelectedTeam } from '@/modules/team/hooks/team/use-selected-team';
import { useLeaveTeamMutation, useUpdateTeamMutation } from '@/modules/team/hooks/team/queries';
import { resetTeamScopedApplicationState, useTeamStore } from '@/modules/team/stores/team/use-team-store';
import { useTeamPresenceStore } from '@/modules/team/stores/team/use-team-presence-store';
import { resolveTeamUserOnline } from '@/modules/team/utilities/member/presence';
import { runAction } from '@/shared/presentation/actions/run-action';
import { confirm, ConfirmActionTone } from '@/shared/presentation/hooks/use-confirm';
import ActivityHeatmap from '@/modules/daily-activity/components/ActivityHeatmap';
import ListingUserCell from '@/shared/presentation/components/ListingUserCell';
import useDailyActivityData from '@/modules/daily-activity/hooks/use-daily-activity-data';
import { teamMembersResource } from '@/modules/team/hooks/member/queries';
import type { GetTeamMembersParams } from '@/modules/team/api/services/member-service';
import useTeamData from '@/modules/team/hooks/team/use-team-data';
import useTeamPermissions from '@/modules/team/hooks/team/use-team-permissions';
import useTeamRoleData from '@/modules/team/hooks/role/use-team-role-data';
import DocumentListing from '@/shared/presentation/components/DocumentListing';
import EditableTag from '@/shared/presentation/components/EditableTag';
import useListingActions from '@/shared/presentation/hooks/use-listing-actions';
import { dateColumn } from '@/shared/presentation/utilities/column-presets';
import { createPromiseToastOptions } from '@/shared/presentation/utilities/toast-options';
import { formatDuration } from '@/shared/utils/format';
import { formatDistanceToNow } from 'date-fns';
import { IoChatbubbleOutline, IoExitOutline, IoPersonRemoveOutline } from 'react-icons/io5';
import { useCallback, useMemo } from 'react';
import type { DailyActivity } from '@/modules/daily-activity/api/entities/daily-activity';
import type { TeamMemberStats } from '@/modules/team/api/entities/member/team-member';
import type { SocketInvalidationConfig } from '@/shared/presentation/components/DocumentListing';
import type { ColumnConfig } from '@/shared/presentation/components/DocumentListingTable';
import { SOCKET_TEAM_MEMBER_EVENTS } from '@/modules/socket/events/team';
import './MyTeam.css';

const TEAM_MEMBERS_QUERY_KEY = ['team-members'] as const;

const SOCKET_INVALIDATION: SocketInvalidationConfig[] = [
    { event: SOCKET_TEAM_MEMBER_EVENTS.CREATED, queryKeys: [TEAM_MEMBERS_QUERY_KEY] },
    { event: SOCKET_TEAM_MEMBER_EVENTS.DELETED, queryKeys: [TEAM_MEMBERS_QUERY_KEY] },
    { event: SOCKET_TEAM_MEMBER_EVENTS.LEFT, queryKeys: [TEAM_MEMBERS_QUERY_KEY] }
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

const leaveTeamToastOptions = createPromiseToastOptions({
    loading: 'Leaving team...',
    success: 'Left team successfully',
    error: 'Failed to leave team'
});

const TEAM_ACTIVITY_LOOKBACK_DAYS = 7;
const TEAM_ACTIVITY_REFRESH_INTERVAL_MS = 10_000;

const buildTimeSpentByUser = (activityData: DailyActivity[]): Map<string, number> => {
    const totalsByUser = new Map<string, number>();

    for (const entry of activityData) {
        const userId = typeof entry.user === 'string'
            ? entry.user
            : entry.user._id;
        const current = totalsByUser.get(userId) ?? 0;
        totalsByUser.set(userId, current + (entry.minutesOnline || 0));
    }

    return totalsByUser;
};

export default function MyTeamTemplate() {
    const chatActions = useChatActions();

    const currentUser = useCurrentUser();
    const selectedTeam = useSelectedTeam()!;
    const { canAccess } = useTeamPermissions();
    const canInvite = canAccess(['team-invitation:create']);

    const { roles } = useTeamRoleData({ teamId: selectedTeam._id });
    const { queryKey, fetchData } = useMemo(
        () => teamMembersResource.createListingAccessors<GetTeamMembersParams>(selectedTeam._id),
        [selectedTeam._id]
    );
    const onlineUserIds = useTeamPresenceStore((state) => state.onlineUserIds);
    const hasPresenceSnapshot = useTeamPresenceStore((state) => state.hasPresenceSnapshot);

    const { teams } = useTeamData();
    const updateTeamMutation = useUpdateTeamMutation();
    const updateTeamMemberMutation = useUpdateTeamMemberMutation();
    const removeTeamMemberMutation = useRemoveTeamMemberMutation();
    const leaveTeamMutation = useLeaveTeamMutation();
    const { activityData } = useDailyActivityData({ scope: 'team' });
    const { activityData: recentActivityData } = useDailyActivityData({
        range: TEAM_ACTIVITY_LOOKBACK_DAYS,
        scope: 'team',
        refetchIntervalMs: TEAM_ACTIVITY_REFRESH_INTERVAL_MS
    });
    const timeSpentByUser = useMemo(() => buildTimeSpentByUser(recentActivityData), [recentActivityData]);

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

    const handleLeaveTeam = useCallback(async () => {
        const isConfirmed = await confirm({
            title: `Leave ${selectedTeam.name}?`,
            description: 'You will lose access to this team until someone invites you again.',
            confirmText: 'Leave team',
            cancelText: 'Stay',
            tone: ConfirmActionTone.Danger
        });
        if (!isConfirmed) return;

        await runAction({
            action: () => leaveTeamMutation.mutateAsync({ teamId: selectedTeam._id }),
            toast: leaveTeamToastOptions,
            afterSuccess: () => {
                const state = useTeamStore.getState();
                if (state.selectedTeamId !== selectedTeam._id) return;

                const remainingTeams = teams.filter((team) => team._id !== selectedTeam._id);
                const nextTeam = remainingTeams[0] ?? null;
                resetTeamScopedApplicationState();
                state.setSelectedTeamId(nextTeam?._id ?? null);
            }
        });
    }, [selectedTeam._id, selectedTeam.name, leaveTeamMutation, teams]);

    const roleOptions = useMemo(() => {
        return roles.map((role) => ({
            value: role._id,
            title: role.name,
            description: role.isSystem ? 'System role' : `${role.permissions.length} permissions`
        }));
    }, [roles]);

    const headerContent = useMemo(() => {
        return (
            <Row gap='1'>
                {canInvite ? (
                    <EditableTag
                        as='h1'
                        className='font-size-6 font-weight-5 sm:font-size-4 color-primary'
                        onSave={handleSaveTeamName}
                    >
                        {selectedTeam.name}
                    </EditableTag>
                ) : (
                    <Heading level={1} className='font-size-6 font-weight-5 sm:font-size-4 color-primary'>{selectedTeam.name}</Heading>
                )}
            </Row>
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
                    <Stack>
                        <StatusBadge status='offline' size='compact'>Offline</StatusBadge>
                        <Text size='md' tone='muted'>
                            {lastSeenAt
                                ? `Seen ${formatDistanceToNow(lastSeenAt)} ago`
                                : 'Last seen unavailable'}
                        </Text>
                    </Stack>
                );
            }
        },
        {
            key: 'timeSpentLast7Days',
            title: 'Time (7d)',
            render: (_value, member) => {
                const timeSpentLast7Days = timeSpentByUser.get(member.user._id) ?? 0;

                return (
                    <Text tone='secondary' size='md'>
                        {formatDuration(timeSpentLast7Days)}
                    </Text>
                );
            }
        },
        dateColumn<TeamMemberStats>('joinedAt', 'Joined At', { sortable: false, withTitle: true })
    ], [canInvite, currentUser?._id, selectedTeam, roleOptions, handleRoleChange, onlineUserIds, hasPresenceSnapshot, timeSpentByUser]);

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
                label: 'Leave team',
                icon: IoExitOutline,
                variant: 'danger',
                scope: 'item',
                handler: () => handleLeaveTeam()
            }
        }
    });

    const getTeamMemberMenuOptions = useCallback((member: TeamMemberStats, selectedMembers: TeamMemberStats[]) => {
        if (!canInvite && selectedMembers.length > 1) {
            return [];
        }

        if (selectedMembers.length > 1) {
            return getSelectionActionOptions(member, selectedMembers)
                .filter((option) => option.label !== 'Leave team');
        }

        const isSelf = currentUser?._id === member.user._id;
        const options = getMenuOptions(member, selectedMembers);

        if (isSelf) {
            return options.filter((option) => option.label === 'Leave team');
        }

        return options.filter((option) => option.label !== 'Leave team');
    }, [canInvite, currentUser?._id, getMenuOptions, getSelectionActionOptions]);

    return (
        <Box height='max' className='my-team-page'>
            <DocumentListing<TeamMemberStats>
                title={headerContent}
                queryKey={queryKey}
                columns={columns}
                fetchData={fetchData}
                getMenuOptions={getTeamMemberMenuOptions}
                emptyMessage='No members found in this team.'
                headerActions={<ActivityHeatmap data={activityData} />}
                socketInvalidation={SOCKET_INVALIDATION}
            />
        </Box>
    );
};
