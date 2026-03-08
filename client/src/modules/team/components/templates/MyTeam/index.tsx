import React, { useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { IoChatbubbleOutline, IoPersonRemoveOutline } from 'react-icons/io5';
import { formatDistanceToNow } from 'date-fns';
import Container from '@/shared/presentation/components/Container';
import DocumentListing, { type ColumnConfig, type SocketInvalidationConfig } from '@/shared/presentation/components/DocumentListing';
import Select from '@/shared/presentation/components/Select';
import EditableTag from '@/shared/presentation/components/EditableTag';
import StatusBadge from '@/shared/presentation/components/StatusBadge';
import UserInfo from '@/modules/auth/components/atoms/UserInfo';
import { useCurrentUser } from '@/modules/auth/hooks/use-current-user';
import { useSelectedTeam } from '@/modules/team/hooks/team/use-selected-team';
import useTeamPermissions from '@/modules/team/hooks/team/use-team-permissions';
import useTeamRoleData from '@/modules/team/hooks/team-role/use-team-role-data';
import useTeamMembersListing from '@/modules/team/hooks/team-member/use-team-members-listing';
import { useUpdateTeamMutation } from '@/modules/team/hooks/team/queries';
import { useRemoveTeamMemberMutation, useUpdateTeamMemberMutation } from '@/modules/team/hooks/team-member/queries';
import useListingActions from '@/shared/presentation/hooks/use-listing-actions';
import { showPromise } from '@/shared/presentation/hooks/toast';
import { confirm } from '@/shared/presentation/hooks/use-confirm';
import type { TeamMember } from '@/modules/team/api/entities/team-member';
import useDailyActivityData from '@/modules/daily-activity/hooks/use-daily-activity-data';
import ActivityHeatmap from '@/modules/daily-activity/components/molecules/ActivityHeatmap';
import { useTeamPresenceStore } from '@/modules/team/stores/use-team-presence-store';
import { resolveTeamUserOnline } from '@/modules/team/utilities/presence';
import ApiError from '@/shared/errors/ApiError';
import './MyTeam.css';

const TEAM_MEMBERS_QUERY_KEY = ['team-members'] as const;

const SOCKET_INVALIDATION: SocketInvalidationConfig[] = [
    { event: 'team-member.created', queryKeys: [TEAM_MEMBERS_QUERY_KEY] },
    { event: 'team-member.deleted', queryKeys: [TEAM_MEMBERS_QUERY_KEY] },
    { event: 'team-member.left', queryKeys: [TEAM_MEMBERS_QUERY_KEY] }
];

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

const MyTeamTemplate: React.FC = () => {
    const navigate = useNavigate();

    const selectedTeam = useSelectedTeam()!;
    const { canAccess } = useTeamPermissions();
    const canInvite = canAccess(['team-invitation:create']);

    const { roles } = useTeamRoleData({ teamId: selectedTeam._id });
    const { queryKey, fetchData } = useTeamMembersListing(selectedTeam._id);

    const user = useCurrentUser()!;

    const updateTeamMutation = useUpdateTeamMutation();
    const updateTeamMemberMutation = useUpdateTeamMemberMutation();
    const removeTeamMemberMutation = useRemoveTeamMemberMutation();
    const { activityData } = useDailyActivityData();

    const onlineUserIds = useTeamPresenceStore((s) => s.onlineUserIds);
    const hasPresenceSnapshot = useTeamPresenceStore((s) => s.hasPresenceSnapshot);

    const handleSaveTeamName = useCallback(async (newName: string) => {
        try{
            await showPromise(
                updateTeamMutation.mutateAsync({ teamId: selectedTeam._id, name: newName }),
                {
                    loading: { title: 'Updating team name...' },
                    success: { title: 'Team name updated' },
                    error: { title: 'Failed to update team name' }
                }
            );
        }catch(error: unknown){
            if(ApiError.isRBACError(error)) return;
        }
    }, [selectedTeam._id, updateTeamMutation]);

    const handleRoleChange = useCallback(async (memberId: string, roleId: string) => {
        try{
            await showPromise(
                updateTeamMemberMutation.mutateAsync({ teamId: selectedTeam._id, memberId, role: roleId }),
                {
                    loading: { title: 'Updating role...' },
                    success: { title: 'Member role updated' },
                    error: { title: 'Failed to update role' }
                }
            );
        }catch(error: unknown){
            if(ApiError.isRBACError(error)) return;
        }
    }, [selectedTeam._id, updateTeamMemberMutation]);

    const handleRemoveMembers = useCallback(async (members: TeamMember[]) => {
        if (!members.length) return;

        const isConfirmed = await confirm(
            members.length === 1
                ? `Are you sure you want to remove ${members[0].user.firstName}?`
                : `Are you sure you want to remove ${members.length} team members?`
        );
        if(!isConfirmed) return;

        for (const member of members) {
            try{
                await showPromise(
                    removeTeamMemberMutation.mutateAsync({ teamId: selectedTeam._id, userId: member.user._id }),
                    {
                        loading: { title: `Removing ${member.user.firstName}...` },
                        success: { title: `${member.user.firstName} removed from team` },
                        error: { title: `Failed to remove ${member.user.firstName}` }
                    }
                );
            }catch(error: unknown){
                if(ApiError.isRBACError(error)) return;
            }
        }
    }, [selectedTeam._id, removeTeamMemberMutation]);

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

    const columns: ColumnConfig[] = useMemo(() => [
        {
            key: 'user',
            title: 'User',
            render: (_: unknown, row?: unknown) => {
                const member = row as TeamMember;
                const isCurrentUser = member.user._id === user._id;
                const isOnline = resolveTeamUserOnline(member.user, onlineUserIds, hasPresenceSnapshot);
                return (
                    <UserInfo
                        user={member.user}
                        showStatus
                        isOnline={isOnline}
                        suffix={isCurrentUser && <span className='color-secondary'>(You)</span>}
                    />
                );
            }
        },
        {
            key: 'role',
            title: 'Role',
            render: (_: unknown, row?: unknown) => {
                const member = row as TeamMember;
                const isOwner = selectedTeam.owner._id === member.user._id;
                
                if(isOwner){
                    return <StatusBadge variant='primary'>Owner</StatusBadge>;
                }
                
                if(canInvite && member.user._id !== user._id && roleOptions.length > 0){
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
            render: (_: unknown, row?: unknown) => {
                const member = row as TeamMember;
                const isOnline = resolveTeamUserOnline(member.user, onlineUserIds, hasPresenceSnapshot);
                const lastSeenAt = member.user.lastSeenAt ? new Date(member.user.lastSeenAt) : null;
                return (
                    <>
                        {isOnline ? (
                            <span className='color-success font-size-2 font-weight-5'>Online</span>
                        ) : (
                            <Container className='d-flex column'>
                                <span className='color-secondary font-size-2'>Offline</span>
                                <span className='color-muted font-size-2'>
                                    {lastSeenAt
                                        ? `Seen ${formatDistanceToNow(lastSeenAt)} ago`
                                        : 'Last seen unavailable'}
                                </span>
                            </Container>
                        )}
                    </>
                );
            }
        },
        {
            key: 'trajectoriesCount',
            title: 'Trajectories',
            render: (val: unknown) => <span className='color-secondary font-size-2'>{val as number}</span>
        },
        {
            key: 'analysesCount',
            title: 'Analyses',
            render: (val: unknown) => <span className='color-secondary font-size-2'>{val as number}</span>
        },
        {
            key: 'timeSpentLast7Days',
            title: 'Time (7d)',
            render: (val: unknown) => {
                const minutes = val as number;
                return (
                    <span className='color-secondary font-size-2'>
                        {formatTrackedMinutes(minutes)}
                    </span>
                );
            }
        },
        {
            key: 'joinedAt',
            title: 'Joined',
            render: (val: unknown) => (
                <span className='color-secondary font-size-2'>
                    {formatDistanceToNow(new Date(val as string), { addSuffix: true })}
                </span>
            )
        }
    ], [canInvite, user, selectedTeam, roleOptions, handleRoleChange, onlineUserIds, hasPresenceSnapshot]);

    const { getMenuOptions, getSelectionActionOptions } = useListingActions<TeamMember>({
        actions: {
            message: {
                label: 'Message',
                icon: IoChatbubbleOutline,
                handler: ({ item: member }) => navigate(`/messages/${member._id}`)
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

    const getTeamMemberMenuOptions = useCallback((member: TeamMember, selectedMembers: TeamMember[]) => {
        if (!canInvite && selectedMembers.length > 1) {
            return [];
        }

        return selectedMembers.length > 1
            ? getSelectionActionOptions(member, selectedMembers)
            : getMenuOptions(member, selectedMembers);
    }, [canInvite, getMenuOptions, getSelectionActionOptions]);

    return (
        <Container className='my-team-page h-max'>
            <DocumentListing<TeamMember>
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

export default MyTeamTemplate;
