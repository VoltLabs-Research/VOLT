
import React, { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import useTeamStore from '@/stores/team/team';
import useAuthStore from '@/stores/authentication';
import Container from '@/components/primitives/Container';
import DocumentListing from '@/components/organisms/common/DocumentListing';
import type { ColumnConfig } from '@/components/organisms/common/DocumentListing';
import { IoChatbubbleOutline, IoPersonRemoveOutline, IoShieldCheckmarkOutline, IoShieldOutline } from 'react-icons/io5';
import EditableTag from '@/components/atoms/common/EditableTag';
import { formatDistanceToNow } from 'date-fns';
import useToast from '@/hooks/ui/use-toast';
import ActivityHeatmap from '@/components/molecules/common/ActivityHeatmap';
import teamApi, { type ActivityData } from '@/services/api/team';
import { useState } from 'react';
import formatTimeAgo from '@/utilities/formatTimeAgo';
import './MyTeam.css';
import dailyActivityApi from '@/services/api/daily-activity';

const MyTeam: React.FC = () => {
    const navigate = useNavigate();
    const { selectedTeam, members, admins, owner, onlineUsers, fetchMembers, initializeSocket, promoteMember, demoteMember, removeMember, updateTeam, isLoading } = useTeamStore();
    const { user: currentUser } = useAuthStore();
    const { showSuccess, showError } = useToast();
    const [activityData, setActivityData] = useState<ActivityData[]>([]);

    useEffect(() => {
        if(selectedTeam){
            dailyActivityApi.getTeamActivity(selectedTeam._id).then(setActivityData);
        }
    }, [selectedTeam]);

    const currentIsOwner = currentUser && owner?._id === currentUser._id;
    const currentIsAdmin = currentUser && admins.some(a => a._id === currentUser._id);
    const canManage = currentIsOwner || currentIsAdmin;

    const handleSaveTeamName = async (newName: string) => {
        if (!selectedTeam || !newName.trim() || newName === selectedTeam.name) return;

        try {
            await updateTeam(selectedTeam._id, { name: newName });
            showSuccess('Team name updated');
        } catch (err) {
            showError('Failed to update team name');
        }
    };

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
    }, [selectedTeam, canManage]);

    useEffect(() => {
        if (selectedTeam) {
            fetchMembers(selectedTeam._id);
            const cleanup = initializeSocket(selectedTeam._id);
            return cleanup;
        }
    }, [selectedTeam, fetchMembers, initializeSocket]);

    const isOnline = (userId: string) => onlineUsers.includes(userId);
    const isOwner = (userId: string) => owner?._id === userId;
    const isAdmin = (userId: string) => admins.some(a => a._id === userId);

    const tableData = useMemo(() => {
        const data = members.map(member => ({
            ...member,
            isOnline: isOnline(member._id),
            isOwner: isOwner(member._id),
            isAdmin: isAdmin(member._id),
            rawJoined: member.joinedAt || member.createdAt
        }));

        return data.sort((a, b) => {
            if (a.isOwner) return -1;
            if (b.isOwner) return 1;
            if (a.isAdmin && !b.isAdmin) return -1;
            if (!a.isAdmin && b.isAdmin) return 1;
            if (a.isOnline && !b.isOnline) return -1;
            if (!a.isOnline && b.isOnline) return 1;
            return 0;
        });
    }, [members, admins, owner, onlineUsers]);

    const columns: ColumnConfig[] = [
        {
            key: 'user',
            title: 'User',
            render: (_: any, member: any) => (
                <div className="d-flex items-center gap-1">
                    <div className="member-avatar p-relative">
                        <img
                            src={member.avatar}
                            alt={member.username}
                            className="avatar-sm object-cover"
                        />
                        {member.isOnline && <span className="status-dot online p-absolute border-white"></span>}
                    </div>
                    <div className="d-flex column">
                        <span className="font-weight-6 color-primary d-flex gap-02 font-size-2">
                            {member.firstName} {member.lastName}
                            {member._id === currentUser?._id && <span className="color-secondary">(You)</span>}
                        </span>
                        <span className="font-size-2 color-secondary">{member.email}</span>
                    </div>
                </div>
            )
        },
        {
            key: 'role',
            title: 'Role',
            render: (_: any, member: any) => (
                <>
                    {member.isOwner && <span className="badge badge-primary">Owner</span>}
                    {!member.isOwner && member.isAdmin && <span className="badge badge-secondary">Admin</span>}
                    {!member.isOwner && !member.isAdmin && <span className="badge badge-outline">Member</span>}
                </>
            )
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
                            {member.lastLoginAt && (
                                <span className="color-tertiary font-size-xs">
                                    Seen {formatDistanceToNow(new Date(member.lastLoginAt))} ago
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
            render: (val: string) => <span className="color-secondary font-size-2">{val ? formatTimeAgo(val) : '-'}</span>
        }
    ];

    const getMenuOptions = (member: any) => {
        const options = [];

        options.push({
            label: 'Message',
            icon: IoChatbubbleOutline,
            onClick: () => navigate(`/messages/${member._id}`)
        });

        if (canManage && !member.isOwner && member._id !== currentUser?._id && selectedTeam) {
            if (!member.isAdmin) {
                options.push({
                    label: 'Make Admin',
                    icon: IoShieldCheckmarkOutline,
                    onClick: () => promoteMember(selectedTeam._id, member._id)
                });
            } else {
                options.push({
                    label: 'Remove Admin',
                    icon: IoShieldOutline,
                    onClick: () => demoteMember(selectedTeam._id, member._id)
                });
            }

            if ((currentIsOwner) || (currentIsAdmin && !member.isAdmin)) {
                options.push({
                    label: 'Remove from Team',
                    icon: IoPersonRemoveOutline,
                    onClick: async () => {
                        if (confirm(`Are you sure you want to remove ${member.firstName}?`)) {
                            await removeMember(selectedTeam._id, member._id);
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
                title={headerContent || 'My Team'}
                columns={columns}
                data={tableData}
                isLoading={isLoading}
                getMenuOptions={getMenuOptions}
                emptyMessage="No members found in this team."
                keyExtractor={(item) => item._id}
                headerActions={
                    <ActivityHeatmap data={activityData} />
                }
                gap=""
            />
        </Container>
    );
};

export default MyTeam;
