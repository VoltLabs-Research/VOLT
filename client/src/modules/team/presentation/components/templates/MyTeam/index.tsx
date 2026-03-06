import React, { useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { IoChatbubbleOutline, IoPersonRemoveOutline } from 'react-icons/io5';
import { formatDistanceToNow } from 'date-fns';
import Container from '@/shared/presentation/components/Container';
import DocumentListing, { createListSyncConfig } from '@/shared/presentation/components/DocumentListing';
import type { ColumnConfig, MenuOption } from '@/shared/presentation/components/DocumentListing';
import Select from '@/shared/presentation/components/Select';
import EditableTag from '@/shared/presentation/components/EditableTag';
import StatusBadge from '@/shared/presentation/components/StatusBadge';
import UserInfo from '@/modules/auth/presentation/components/atoms/UserInfo';
import { useTeamStore } from '@/modules/team/presentation/stores/use-team-store';
import { useSelectedTeam } from '@/modules/team/presentation/hooks/use-selected-team';
import { useTeamMemberStore } from '@/modules/team/presentation/stores/use-team-member-store';
import { useTeamRoleStore } from '@/modules/team/presentation/stores/use-team-role-store';
import { useCurrentUser } from '@/modules/auth/presentation/hooks/use-current-user';
import useTeamData from '@/modules/team/presentation/hooks/team/use-team-data';
import useTeamRoleData from '@/modules/team/presentation/hooks/team-role/use-team-role-data';
import useTeamUseCases from '@/modules/team/presentation/hooks/team/use-team-services';
import useTeamMemberUseCases from '@/modules/team/presentation/hooks/team-member/use-team-member-repository';
import { showPromise } from '@/shared/presentation/hooks/toast';
import { confirm } from '@/shared/presentation/hooks/use-confirm';
import type { GetTeamMembersParams } from '@/modules/team/domain/port/ITeamMemberRepository';
import type { TeamMember } from '@/modules/team/domain/entities/TeamMember';
import useDailyActivityData from '@/modules/daily-activity/presentation/hooks/use-daily-activity-data';
import ActivityHeatmap from '@/modules/daily-activity/presentation/components/molecules/ActivityHeatmap';
import { useTeamPresenceStore } from '@/modules/team/presentation/stores/use-team-presence-store';
import { canAccessTeamPermissions } from '@/modules/team/presentation/utilities/permission-evaluator';
import { resolveTeamUserOnline } from '@/modules/team/presentation/utilities/presence';
import ApiError from '@/shared/errors/ApiError';
import './MyTeam.css';

const LIST_SYNC = createListSyncConfig('team-member');

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
    const teamPermissions = useTeamStore((state) => state.permissions);
    const permissionsTeamId = useTeamStore((state) => state.permissionsTeamId);
    const updateTeamInList = useTeamStore((state) => state.updateTeamInList);
    const canInvite = canAccessTeamPermissions({
        selectedTeamId: selectedTeam._id,
        permissionsTeamId,
        permissions: teamPermissions,
        requiredPermissions: ['team-invitation:create']
    });

    const removeMemberFromStore = useTeamMemberStore((state) => state.removeMember);
    const updateMember = useTeamMemberStore((state) => state.updateMember);

    const roles = useTeamRoleStore((state) => state.roles);

    const user = useCurrentUser()!;

    const { hydrateTeamAccess } = useTeamData();
    const { fetchRoles } = useTeamRoleData();
    const { teamRepository } = useTeamUseCases();
    const { teamMemberRepository } = useTeamMemberUseCases();
    const { activityData, fetchActivity } = useDailyActivityData();

    const onlineUserIds = useTeamPresenceStore((s) => s.onlineUserIds);
    const hasPresenceSnapshot = useTeamPresenceStore((s) => s.hasPresenceSnapshot);

    useEffect(() => {
        let isCancelled = false;

        const loadTeamContext = async () => {
            await Promise.all([
                fetchRoles(selectedTeam._id),
                hydrateTeamAccess(selectedTeam._id)
            ]);
            if (isCancelled) {
                return;
            }

            await fetchActivity();
        };

        void loadTeamContext();

        return () => {
            isCancelled = true;
        };
    }, [selectedTeam._id, fetchRoles, hydrateTeamAccess, fetchActivity]);

    const fetchData = useCallback(async (params: GetTeamMembersParams) => {
        return await teamMemberRepository.getAll(selectedTeam._id, params);
    }, [selectedTeam._id, teamMemberRepository]);

    const handleSaveTeamName = useCallback(async (newName: string) => {
        try{
            await showPromise(
                teamRepository.update(selectedTeam._id, { name: newName }),
                {
                    loading: { title: 'Updating team name...' },
                    success: { title: 'Team name updated' },
                    error: { title: 'Failed to update team name' }
                }
            );
            updateTeamInList(selectedTeam._id, { name: newName });
        }catch(error: unknown){
            if(ApiError.isRBACError(error)) return;
        }
    }, [selectedTeam._id, teamRepository, updateTeamInList]);

    const handleRoleChange = useCallback(async (memberId: string, roleId: string) => {
        try{
            const updated = await showPromise(
                teamMemberRepository.update(selectedTeam._id, memberId, { role: roleId }),
                {
                    loading: { title: 'Updating role...' },
                    success: { title: 'Member role updated' },
                    error: { title: 'Failed to update role' }
                }
            );
            updateMember(memberId, updated);
        }catch(error: unknown){
            if(ApiError.isRBACError(error)) return;
        }
    }, [selectedTeam._id, teamMemberRepository, updateMember]);

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
                    teamMemberRepository.remove(selectedTeam._id, member.user._id),
                    {
                        loading: { title: `Removing ${member.user.firstName}...` },
                        success: { title: `${member.user.firstName} removed from team` },
                        error: { title: `Failed to remove ${member.user.firstName}` }
                    }
                );
                removeMemberFromStore(member._id);
            }catch(error: unknown){
                if(ApiError.isRBACError(error)) return;
            }
        }
    }, [selectedTeam._id, teamMemberRepository, removeMemberFromStore]);

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

    const getMenuOptions = useCallback((member: TeamMember, selectedMembers: TeamMember[]): MenuOption[] => {
        const targetMembers = selectedMembers.includes(member) ? selectedMembers : [member];
        const isMultipleSelection = targetMembers.length > 1;
        const options: MenuOption[] = [];

        if (isMultipleSelection) {
            if (!canInvite) {
                return [];
            }

            return [{
                label: 'Delete',
                icon: IoPersonRemoveOutline,
                onClick: () => handleRemoveMembers(targetMembers),
                destructive: true
            }];
        }

        options.push({
            label: 'Message',
            icon: IoChatbubbleOutline,
            onClick: () => navigate(`/messages/${member._id}`)
        });

        if(canInvite){
            options.push({
                label: 'Remove from Team',
                icon: IoPersonRemoveOutline,
                onClick: () => handleRemoveMembers(targetMembers),
                destructive: true
            });
        }

        return options;
    }, [canInvite, navigate, handleRemoveMembers]);

    return (
        <Container className='my-team-page h-max'>
            <DocumentListing<TeamMember>
                title={headerContent}
                columns={columns}
                fetchData={fetchData}
                getMenuOptions={getMenuOptions}
                emptyMessage='No members found in this team.'
                headerActions={<ActivityHeatmap data={activityData} />}
                gap=''
                listSyncConfig={LIST_SYNC}
            />
        </Container>
    );
};

export default MyTeamTemplate;
