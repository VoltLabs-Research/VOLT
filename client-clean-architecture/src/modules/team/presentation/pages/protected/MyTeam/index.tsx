import React, { useEffect, useMemo, useCallback, useState } from 'react';
import { usePageTitle } from '@/shared/presentation/hooks/core/use-page-title';
import { useNavigate } from 'react-router-dom';
import { useTeamStore } from '@/modules/team/presentation/stores';
import { useTeamRoleStore } from '@/modules/team-role/presentation/stores';
import { useAuthStore } from '@/modules/auth/presentation/stores';
import Container from '@/shared/presentation/components/primitives/Container';
import DocumentListing, { type ColumnConfig } from '@/shared/presentation/components/organisms/common/DocumentListing';
import Select from '@/shared/presentation/components/atoms/form/Select';
import { IoChatbubbleOutline, IoPersonRemoveOutline } from 'react-icons/io5';
import EditableTag from '@/shared/presentation/components/atoms/common/EditableTag';
import useToast from '@/shared/presentation/hooks/ui/use-toast';
import ActivityHeatmap from '@/shared/presentation/components/molecules/common/ActivityHeatmap';
import type { ActivityData } from '@/modules/daily-activity/domain/entities';
import { formatDistanceToNow } from 'date-fns';
import { getDailyActivityUseCases } from '@/modules/daily-activity/application/registry';
import useConfirm from '@/shared/presentation/hooks/ui/use-confirm';
import '@/modules/team/presentation/pages/protected/MyTeam/MyTeam.css';

const MyTeam: React.FC = () => {
    usePageTitle('My Team');
    const navigate = useNavigate();
    const { getDailyActivityUseCase } = getDailyActivityUseCases();
    const { selectedTeam, members, admins, owner, onlineUsers, fetchMembers, initializeSocket, removeMember, updateTeam, isLoading } = useTeamStore();
    const { roles, fetchRoles, assignRole, members: membersWithRoles } = useTeamRoleStore();
    const { user: currentUser } = useAuthStore();
    const { showSuccess, showError } = useToast();
    const { confirm } = useConfirm();
    const [activityData, setActivityData] = useState<ActivityData[]>([]);

    const [page, setPage] = useState(1);
    const limit = 20;

    useEffect(() => {
        if (selectedTeam) {
            getDailyActivityUseCase.execute(selectedTeam._id).then(setActivityData).catch(() => null);
            fetchRoles(selectedTeam._id);
            fetchMembers(selectedTeam._id);
            const cleanup = initializeSocket(selectedTeam._id);
            return cleanup;
        }
    }, [selectedTeam, fetchRoles, fetchMembers, initializeSocket, getDailyActivityUseCase]);

    const ownerId = selectedTeam?.owner && typeof selectedTeam.owner !== 'string' ? selectedTeam.owner._id?.toString() : undefined;
    const currentIsOwner = !!(currentUser && ownerId && ownerId === currentUser._id);
    const currentIsAdmin = !!(currentUser && admins?.some?.(a => a._id === currentUser._id));
    const canManage = currentIsOwner || currentIsAdmin;

    const handleSaveTeamName = useCallback(async (newName: string) => {
        if (!selectedTeam || !newName.trim() || newName === selectedTeam.name) return;

        try {
            await updateTeam(selectedTeam._id, { name: newName });
            showSuccess('Team name updated');
        } catch (err) {
            showError('Failed to update team name');
        }
    }, [selectedTeam, updateTeam, showSuccess, showError]);

    const handleRoleChange = useCallback(async (memberId: string, roleId: string) => {
        if (!selectedTeam?._id) return;

        try {
            await assignRole(selectedTeam._id, memberId, roleId);
            showSuccess('Role updated successfully');
            fetchMembers(selectedTeam._id, true);
        } catch (err: any) {
            showError(err?.message || 'Failed to update role');
        }
    }, [selectedTeam?._id, assignRole, fetchMembers, showSuccess, showError]);

    const headerContent = useMemo(() => {
        if (!selectedTeam) return null;

        return (
            <div className="d-flex items-center gap-1">
                {canManage ? (
                    <EditableTag
                        as="h1"
                        className="font-size-6 font-weight-5 sm:font-size-4 color-primary"
                        onSave={handleSaveTeamName}
                    >
                        {selectedTeam.name}
                    </EditableTag>
                ) : (
                    <h1 className="font-size-6 font-weight-5 sm:font-size-4 color-primary">{selectedTeam.name}</h1>
                )}
            </div>
        );
    }, [selectedTeam, canManage, handleSaveTeamName]);

    const isOnline = (userId: string) => onlineUsers.includes(userId);
    const isOwnerCheck = (userId: string) => ownerId === userId;
    const isAdmin = (userId: string) => admins?.some?.(a => a._id === userId);

    const memberRoleMap = useMemo(() => {
        const map = new Map<string, { memberId: string; roleId: string; roleName: string; isSystem: boolean }>();
        membersWithRoles.forEach((m: any) => {
            map.set(m._id, {
                memberId: m._id,
                roleId: m.role?._id || (typeof m.role === 'string' ? m.role : ''),
                roleName: m.role?.name || 'Member',
                isSystem: m.role?.isSystem || false
            });
        });
        return map;
    }, [membersWithRoles]);

    const roleOptions = useMemo(() => {
        return roles.map((role: any) => ({
            value: role._id,
            title: role.name,
            description: role.isSystem ? 'System role' : `${role.permissions.length} permissions`
        }));
    }, [roles]);

    const tableData = useMemo(() => {
        const data = members.map(member => {
            const roleInfo = memberRoleMap.get(member._id);
            return {
                ...member,
                isOnline: isOnline(member.user._id),
                isOwner: isOwnerCheck(member._id),
                isAdmin: isAdmin(member._id),
                rawJoined: member.joinedAt,
                teamMemberId: roleInfo?.memberId,
                currentRoleId: roleInfo?.roleId,
                currentRoleName: roleInfo?.roleName || (isOwnerCheck(member._id) ? 'Owner' : isAdmin(member._id) ? 'Admin' : 'Member'),
                roleIsSystem: roleInfo?.isSystem
            };
        });

        return data.sort((a, b) => {
            if (a.isOwner) return -1;
            if (b.isOwner) return 1;
            if (a.isAdmin && !b.isAdmin) return -1;
            if (!a.isAdmin && b.isAdmin) return 1;
            if (a.isOnline && !b.isOnline) return -1;
            if (!a.isOnline && b.isOnline) return 1;
            return 0;
        });
    }, [members, admins, owner, onlineUsers, memberRoleMap]);

    const visibleData = useMemo(() => tableData.slice(0, page * limit), [tableData, page, limit]);
    const hasMore = visibleData.length < tableData.length;

    const handleLoadMore = useCallback(() => {
        setPage((prev) => prev + 1);
    }, []);

    const columns: ColumnConfig[] = useMemo(() => [
        {
            key: 'user',
            title: 'User',
            render: (_: any, member: any) => (
                <div className="d-flex items-center gap-1">
                    <div className="member-avatar p-relative">
                        <img
                            src={member.user.avatar}
                            alt={member.email}
                            className="avatar-sm object-cover"
                        />
                        {member.isOnline && <span className="status-dot online p-absolute border-white"></span>}
                    </div>
                    <div className="d-flex column">
                        <span className="font-weight-6 color-primary d-flex gap-02 font-size-2">
                            {member.user.firstName} {member.user.lastName}
                            {member.user._id === currentUser?._id && <span className="color-secondary">(You)</span>}
                        </span>
                        <span className="font-size-2 color-secondary">{member.user.email}</span>
                    </div>
                </div>
            )
        },
        {
            key: 'role',
            title: 'Role',
            render: (_: any, member: any) => {
                if (member.isOwner) {
                    return <span className="badge badge-primary">Owner</span>;
                }
                if (canManage && member.user._id !== currentUser?._id && roleOptions.length > 0) {
                    return (
                        <Select
                            options={roleOptions}
                            value={member.currentRoleId || member.role?._id || (typeof member.role === 'string' ? member.role : null)}
                            onChange={(roleId) => handleRoleChange(member._id, roleId)}
                            placeholder="Select role..."
                            className="role-select-compact"
                        />
                    );
                }

                return <span className="badge badge-outline">{member.role?.name}</span>;
            }
        },
        {
            key: 'status',
            title: 'Status',
            render: (_: any, member: any) => (
                <>
                    {member.isOnline ? (
                        <span className="color-success font-size-2 font-weight-5">Online</span>
                    ) : (
                        <div className="d-flex column">
                            <span className="color-secondary font-size-2">Offline</span>
                            {member.user.lastLoginAt && (
                                <span className="color-tertiary font-size-2">
                                    Seen {formatDistanceToNow(new Date(member.user.lastLoginAt))} ago
                                </span>
                            )}
                        </div>
                    )}
                </>
            )
        },
        {
            key: 'trajectoriesCount',
            title: 'Trajectories',
            render: (val: number) => <span className="color-secondary font-size-2">{val || 0}</span>
        },
        {
            key: 'analysesCount',
            title: 'Analyses',
            render: (val: number) => <span className="color-secondary font-size-2">{val || 0}</span>
        },
        {
            key: 'timeSpentLast7Days',
            title: 'Time (7d)',
            render: (val: number) => {
                if (!val) return <span className="color-secondary font-size-2">0m</span>;
                const hours = Math.floor(val / 60);
                const minutes = val % 60;
                return (
                    <span className="color-secondary font-size-2">
                        {hours > 0 ? `${hours}h ` : ''}{minutes}m
                    </span>
                );
            }
        },
        {
            key: 'rawJoined',
            title: 'Joined',
            render: (val: string) => <span className="color-secondary font-size-2">{val ? formatDistanceToNow(val, { addSuffix: true }) : '-'}</span>
        }
    ], [canManage, currentUser, roleOptions, handleRoleChange]);

    const getMenuOptions = (member: any) => {
        const options = [];

        options.push({
            label: 'Message',
            icon: IoChatbubbleOutline,
            onClick: () => navigate(`/messages/${member._id}`)
        });

        if (canManage && !member.isOwner && member._id !== currentUser?._id && selectedTeam) {
            if (currentIsOwner || (currentIsAdmin && !member.isAdmin)) {
                options.push({
                    label: 'Remove from Team',
                    icon: IoPersonRemoveOutline,
                    onClick: async () => {
                        const isConfirmed = await confirm(`Are you sure you want to remove ${member.user.firstName}?`);
                        if (isConfirmed) {
                            await removeMember(selectedTeam._id, member.user._id);
                        }
                    },
                    destructive: true
                });
            }
        }
        return options;
    };

    if (!selectedTeam) return <Container className="p-5">Please select a team.</Container>;

    return (
        <Container className="my-team-page dashboard-content-padding h-100">
            <DocumentListing
                title={headerContent || `My Team (${tableData.length})`}
                columns={columns}
                data={visibleData}
                isLoading={isLoading}
                getMenuOptions={getMenuOptions}
                emptyMessage="No members found in this team."
                keyExtractor={(item: any) => item._id}
                headerActions={<ActivityHeatmap data={activityData} />}
                gap=""
                hasMore={hasMore}
                onLoadMore={handleLoadMore}
            />
        </Container>
    );
};

export default MyTeam;
