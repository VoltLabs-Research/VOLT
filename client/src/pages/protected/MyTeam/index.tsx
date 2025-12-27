
import React, { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import useTeamStore from '@/stores/team/team';
import useAuthStore from '@/stores/authentication';
import Container from '@/components/primitives/Container';
import DocumentListing from '@/components/organisms/common/DocumentListing';
import type { ColumnConfig } from '@/components/organisms/common/DocumentListing';
import { IoChatbubbleOutline, IoPersonRemoveOutline, IoShieldCheckmarkOutline, IoShieldOutline } from 'react-icons/io5';
import { formatDistanceToNow } from 'date-fns';
import './MyTeam.css';

const MyTeam: React.FC = () => {
    const navigate = useNavigate();
    const { selectedTeam, members, admins, owner, onlineUsers, fetchMembers, initializeSocket, promoteMember, demoteMember, removeMember, isLoading } = useTeamStore();
    const { user: currentUser } = useAuthStore();

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

    const currentIsOwner = currentUser && owner?._id === currentUser._id;
    const currentIsAdmin = currentUser && admins.some(a => a._id === currentUser._id);
    const canManage = currentIsOwner || currentIsAdmin;

    const tableData = useMemo(() => {
        const data = members.map(member => ({
            ...member,
            isOnline: isOnline(member._id),
            isOwner: isOwner(member._id),
            isAdmin: isAdmin(member._id),
            rawJoined: member.createdAt
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
                <div className="d-flex items-center gap-2">
                    <div className="member-avatar p-relative">
                        <img
                            src={member.avatar || `https://ui-avatars.com/api/?name=${member.username}&background=random`}
                            alt={member.username}
                            className="avatar-sm circle object-cover"
                        />
                        {member.isOnline && <span className="status-dot online p-absolute border-white"></span>}
                    </div>
                    <div className="d-flex column">
                        <span className="font-weight-6 color-primary">
                            {member.firstName} {member.lastName}
                            {member._id === currentUser?._id && <span className="color-secondary font-size-xs ml-1">(You)</span>}
                        </span>
                        <span className="font-size-xs color-secondary">{member.email}</span>
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
                        <span className="color-success font-size-sm font-weight-5">Online</span>
                    ) : (
                        <div className="d-flex column">
                            <span className="color-secondary font-size-sm">Offline</span>
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
            key: 'createdAt',
            title: 'Joined',
            render: (val: string) => <span className="color-secondary font-size-sm">{val ? new Date(val).toLocaleDateString() : '-'}</span>
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
                title="My Team"
                columns={columns}
                data={tableData}
                isLoading={isLoading}
                getMenuOptions={getMenuOptions}
                emptyMessage="No members found in this team."
                keyExtractor={(item) => item._id}
            />
        </Container>
    );
};

export default MyTeam;
