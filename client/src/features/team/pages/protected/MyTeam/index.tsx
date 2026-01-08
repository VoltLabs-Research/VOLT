import React, { useEffect, useMemo, useCallback } from 'react';
import { usePageTitle } from '@/hooks/core/use-page-title';
import { useNavigate } from 'react-router-dom';
import { useTeamStore } from '@/stores/slices/team';
import { useTeamRoleStore } from '@/stores/slices/team';
import { useAuthStore } from '@/features/auth/stores';
import Container from '@/components/primitives/Container';
import DocumentListing from '@/components/organisms/common/DocumentListing';
import type { ColumnConfig } from '@/components/organisms/common/DocumentListing';
import Select from '@/components/atoms/form/Select';
import { IoChatbubbleOutline, IoPersonRemoveOutline } from 'react-icons/io5';
import EditableTag from '@/components/atoms/common/EditableTag';
import useToast from '@/hooks/ui/use-toast';
import ActivityHeatmap from '@/components/molecules/common/ActivityHeatmap';
import type { ActivityData } from '@/features/team/api/team';
import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import './MyTeam.css';
import dailyActivityApi from '@/services/api/daily-activity/daily-activity';
import useConfirm from '@/hooks/ui/use-confirm';

const MyTeam: React.FC = () => {
    usePageTitle('My Team');
    const navigate = useNavigate();
    const { selectedTeam, members, admins, owner, onlineUsers, fetchMembers, initializeSocket, removeMember, updateTeam, isLoading } = useTeamStore();
    const { roles, fetchRoles, assignRole, members: membersWithRoles } = useTeamRoleStore();
    const { user: currentUser } = useAuthStore();
    const { showSuccess, showError } = useToast();
    const { confirm } = useConfirm();
    const [activityData, setActivityData] = useState<ActivityData[]>([]);

    // Client-side pagination state
    const [page, setPage] = useState(1);
    const limit = 20;

    useEffect(() => {
        if (selectedTeam) {
            dailyActivityApi.getTeamActivity(selectedTeam._id).then(setActivityData);
            fetchRoles(selectedTeam._id);
            fetchMembers(selectedTeam._id);
            const cleanup = initializeSocket(selectedTeam._id);
            return cleanup;
        }
    }, [selectedTeam, fetchRoles, fetchMembers, initializeSocket]);

    const ownerId = selectedTeam?.owner?._id?.toString();
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
            // Refresh members data
            fetchMembers(selectedTeam._id);
        } catch (err: any) {
            showError(err?.message || 'Failed to update role');
        }
    }, [selectedTeam?._id, assignRole, fetchMembers, showSuccess, showError]);

    const headerContent = useMemo(() => {
        if (!selectedTeam) return null;

        return (
            <div className="d-flex items-center gap-1">
                {canManage ? (
                    <>
                        <EditableTag
                            as="h1"
                            className="font-size-6 font-weight-5 sm:font-size-4 color-primary"
                            onSave={handleSaveTeamName}
                        >
                            {selectedTeam.name}
                        </EditableTag>
                    </>
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
        membersWithRoles.forEach(m => {
            const userId = typeof m.user === 'object' ? m.user._id : m.user;
            map.set(userId, {
                memberId: m._id,
                roleId: m.role?._id || '',
                roleName: m.role?.name || 'Member',
                isSystem: m.role?.isSystem || false
            });
        });
        return map;
    }, [membersWithRoles]);

    const roleOptions = useMemo(() => {
        return roles.map(role => ({
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

    const visibleData = useMemo(() => {
        return tableData.slice(0, page * limit);
    }, [tableData, page, limit]);

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
                console.log(member.user._id !== currentUser?._id, canManage)
                if (canManage && member.user._id !== currentUser?._id && roleOptions.length > 0) {
                    return (
                        <Select
                            options={roleOptions}
                            value={member.role._id || null}
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
            if ((currentIsOwner) || (currentIsAdmin && !member.isAdmin)) {
                options.push({
                    label: 'Remove from Team',
                    icon: IoPersonRemoveOutline,
                    onClick: async () => {
                        const isConfirmed = await confirm(`Are you sure you want to remove ${member.firstName}?`);
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
                keyExtractor={(item) => item._id}
                headerActions={
                    <ActivityHeatmap data={activityData} />
                }
                gap=""
                hasMore={hasMore}
                onLoadMore={handleLoadMore}
            />
        </Container>
    );
};

export default MyTeam;
