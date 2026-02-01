import React, { useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { IoChatbubbleOutline, IoPersonRemoveOutline } from 'react-icons/io5';
import { formatDistanceToNow } from 'date-fns';
import Container from '@/shared/presentation/components/Container';
import DocumentListing from '@/shared/presentation/components/DocumentListing';
import type { ColumnConfig, MenuOption } from '@/shared/presentation/components/DocumentListing';
import Select from '@/shared/presentation/components/Select';
import EditableTag from '@/shared/presentation/components/EditableTag';
import UserInfo from '@/modules/auth/presentation/components/atoms/UserInfo';
import { useTeamStore } from '@/modules/team/presentation/stores/use-team-store';
import { useTeamMemberStore } from '@/modules/team/presentation/stores/use-team-member-store';
import { useTeamRoleStore } from '@/modules/team/presentation/stores/use-team-role-store';
import { useAuthStore } from '@/modules/auth/presentation/stores/use-auth-store';
import useTeamData from '@/modules/team/presentation/hooks/team/use-team-data';
import useTeamMemberData from '@/modules/team/presentation/hooks/team-member/use-team-member-data';
import useTeamRoleData from '@/modules/team/presentation/hooks/team-role/use-team-role-data';
import useTeamUseCases from '@/modules/team/presentation/hooks/team/use-team-use-cases';
import useTeamMemberUseCases from '@/modules/team/presentation/hooks/team-member/use-team-member-use-cases';
import { confirm } from '@/shared/presentation/hooks/use-confirm';
import type { TeamMember } from '@/modules/team/domain/entities/TeamMember';
import './MyTeam.css';

const MyTeamTemplate: React.FC = () => {
    const navigate = useNavigate();

    const selectedTeam = useTeamStore((state) => state.selectedTeam);
    const canInvite = useTeamStore((state) => state.canInvite);
    const updateTeamInList = useTeamStore((state) => state.updateTeamInList);

    const members = useTeamMemberStore((state) => state.members);
    const isLoadingMembers = useTeamMemberStore((state) => state.isLoading);
    const removeMemberFromStore = useTeamMemberStore((state) => state.removeMember);
    const updateMemberInList = useTeamMemberStore((state) => state.updateMemberInList);

    const roles = useTeamRoleStore((state) => state.roles);

    const user = useAuthStore((state) => state.user);

    const { checkCanInvite } = useTeamData();
    const { fetchMembers } = useTeamMemberData();
    const { fetchRoles } = useTeamRoleData();
    const { teamRepository } = useTeamUseCases();
    const { teamMemberRepository } = useTeamMemberUseCases();

    useEffect(() => {
        if(selectedTeam){
            fetchMembers(selectedTeam._id);
            fetchRoles(selectedTeam._id);
            checkCanInvite(selectedTeam._id);
        }
    }, [selectedTeam, fetchMembers, fetchRoles, checkCanInvite]);

    const handleSaveTeamName = useCallback(async (newName: string) => {
        if(!selectedTeam || !newName.trim() || newName === selectedTeam.name) return;

        try{
            await teamRepository.update(selectedTeam._id, { name: newName });
            updateTeamInList(selectedTeam._id, { name: newName });
        }catch(err){
            console.error('Failed to update team name:', err);
        }
    }, [selectedTeam, teamRepository, updateTeamInList]);

    const handleRoleChange = useCallback(async (memberId: string, roleId: string) => {
        if(!selectedTeam?._id) return;

        try{
            const updated = await teamMemberRepository.update(selectedTeam._id, memberId, { role: roleId });
            updateMemberInList(memberId, updated);
        }catch(err){
            console.error('Failed to update role:', err);
        }
    }, [selectedTeam?._id, teamMemberRepository, updateMemberInList]);

    const handleRemoveMember = useCallback(async (member: TeamMember) => {
        if(!selectedTeam) return;

        const isConfirmed = await confirm(`Are you sure you want to remove ${member.user.firstName}?`);
        if(!isConfirmed) return;

        try{
            await teamMemberRepository.remove(selectedTeam._id, member.user._id);
            removeMemberFromStore(member._id);
        }catch(err){
            console.error('Failed to remove member:', err);
        }
    }, [selectedTeam, teamMemberRepository, removeMemberFromStore]);

    const roleOptions = useMemo(() => {
        return roles.map((role) => ({
            value: role._id,
            title: role.name,
            description: role.isSystem ? 'System role' : `${role.permissions.length} permissions`
        }));
    }, [roles]);

    const headerContent = useMemo(() => {
        if(!selectedTeam) return null;

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
                const isCurrentUser = member.user._id === user?._id;
                return (
                    <UserInfo
                        user={member.user}
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
                const isOwner = selectedTeam?.owner?._id === member.user._id;
                
                if(isOwner){
                    return <span className='badge badge-primary'>Owner</span>;
                }
                
                if(canInvite && member.user._id !== user?._id && roleOptions.length > 0){
                    return (
                        <Select
                            options={roleOptions}
                            value={member.role?._id || ''}
                            onChange={(roleId) => handleRoleChange(member._id, roleId)}
                            placeholder='Select role...'
                            className='role-select-compact'
                        />
                    );
                }

                return <span className='badge badge-outline'>{member.role?.name || 'Member'}</span>;
            }
        },
        {
            key: 'status',
            title: 'Status',
            render: (_: unknown, row?: unknown) => {
                const member = row as TeamMember;
                // TODO: Implement online status when socket is ready
                const isOnline = false;
                return (
                    <>
                        {isOnline ? (
                            <span className='color-success font-size-2 font-weight-5'>Online</span>
                        ) : (
                            <Container className='d-flex column'>
                                <span className='color-secondary font-size-2'>Offline</span>
                                {member.user.lastLoginAt && (
                                    <span className='color-muted font-size-2'>
                                        Seen {formatDistanceToNow(new Date(member.user.lastLoginAt))} ago
                                    </span>
                                )}
                            </Container>
                        )}
                    </>
                );
            }
        },
        {
            key: 'trajectoriesCount',
            title: 'Trajectories',
            render: (val: unknown) => <span className='color-secondary font-size-2'>{(val as number) || 0}</span>
        },
        {
            key: 'analysesCount',
            title: 'Analyses',
            render: (val: unknown) => <span className='color-secondary font-size-2'>{(val as number) || 0}</span>
        },
        {
            key: 'timeSpentLast7Days',
            title: 'Time (7d)',
            render: (val: unknown) => {
                const minutes = val as number;
                if(!minutes) return <span className='color-secondary font-size-2'>0m</span>;
                const hours = Math.floor(minutes / 60);
                const mins = minutes % 60;
                return (
                    <span className='color-secondary font-size-2'>
                        {hours > 0 ? `${hours}h ` : ''}{mins}m
                    </span>
                );
            }
        },
        {
            key: 'joinedAt',
            title: 'Joined',
            render: (val: unknown) => (
                <span className='color-secondary font-size-2'>
                    {val ? formatDistanceToNow(new Date(val as string), { addSuffix: true }) : '-'}
                </span>
            )
        }
    ], [canInvite, user, selectedTeam, roleOptions, handleRoleChange]);

    const getMenuOptions = useCallback((member: TeamMember): MenuOption[] => {
        const options: MenuOption[] = [];

        options.push({
            label: 'Message',
            icon: IoChatbubbleOutline,
            onClick: () => navigate(`/messages/${member._id}`)
        });

        if(canInvite){
            options.push({
                label: 'Remove from Team',
                icon: IoPersonRemoveOutline,
                onClick: () => handleRemoveMember(member),
                destructive: true
            });
        }

        return options;
    }, [canInvite, navigate, handleRemoveMember]);

    if(!selectedTeam){
        return <Container className='p-3'>Please select a team.</Container>;
    }

    return (
        <Container className='my-team-page h-max'>
            <DocumentListing<TeamMember>
                title={headerContent || `My Team (${members.length})`}
                columns={columns}
                data={members}
                isLoading={isLoadingMembers}
                getMenuOptions={getMenuOptions}
                emptyMessage='No members found in this team.'
                gap=''
            />
        </Container>
    );
};

export default MyTeamTemplate;
