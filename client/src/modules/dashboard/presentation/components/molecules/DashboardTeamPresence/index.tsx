import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@mui/material';
import { Users } from 'lucide-react';
import { GoArrowRight } from 'react-icons/go';
import { useSelectedTeam } from '@/modules/team/presentation/hooks/use-selected-team';
import useTeamMemberData from '@/modules/team/presentation/hooks/team-member/use-team-member-data';
import { useTeamMemberStore } from '@/modules/team/presentation/stores/use-team-member-store';
import { useTeamPresenceStore } from '@/modules/team/presentation/stores/use-team-presence-store';
import { resolveTeamUserOnline } from '@/modules/team/presentation/utilities/presence';
import Avatar from '@/shared/presentation/components/Avatar';
import Container from '@/shared/presentation/components/Container';
import Title from '@/shared/presentation/components/Title';
import Button from '@/shared/presentation/components/Button';
import AccessDenied from '@/shared/presentation/components/AccessDenied';
import type { User } from '@/modules/auth/domain/entities/User';
import './DashboardTeamPresence.css';

const DashboardTeamPresence = () => {
    const navigate = useNavigate();
    const selectedTeam = useSelectedTeam()!;
    const { fetchMembers, accessDenied, accessDeniedMessage } = useTeamMemberData();
    const members = useTeamMemberStore((state) => state.members);
    const isLoading = useTeamMemberStore((state) => state.isLoading);
    const onlineUserIds = useTeamPresenceStore((s) => s.onlineUserIds);
    const hasPresenceSnapshot = useTeamPresenceStore((s) => s.hasPresenceSnapshot);

    useEffect(() => {
        fetchMembers(selectedTeam._id);
    }, [fetchMembers, selectedTeam._id]);

    const { onlineMembers, offlineMembers } = useMemo(() => {
        const online: { user: User; memberId: string }[] = [];
        const offline: { user: User; memberId: string }[] = [];

        for (const member of members) {
            const user = member.user as User | undefined;
            if (!user?._id) continue;

            if (resolveTeamUserOnline(user, onlineUserIds, hasPresenceSnapshot)) {
                online.push({ user, memberId: member._id });
            } else {
                offline.push({ user, memberId: member._id });
            }
        }

        return { onlineMembers: online, offlineMembers: offline };
    }, [members, onlineUserIds, hasPresenceSnapshot]);

    const totalCount = members.length;
    const onlineCount = onlineMembers.length;

    if (accessDenied) {
        return (
            <Container className='dashboard-presence-card'>
                <AccessDenied description={accessDeniedMessage} showBack={false} />
            </Container>
        );
    }

    if (isLoading) {
        return (
            <Container className='dashboard-presence-card'>
                <Container className='dashboard-presence-header'>
                    <Title className='font-size-3 color-primary font-weight-5'>{selectedTeam.name}</Title>
                </Container>
                <Container className='d-flex items-center gap-05' style={{ flexWrap: 'wrap' }}>
                    {Array.from({ length: 5 }, (_, i) => (
                        <Skeleton key={i} variant='circular' width={32} height={32} />
                    ))}
                </Container>
            </Container>
        );
    }

    const allSorted = [...onlineMembers, ...offlineMembers];

    return (
        <Container className='dashboard-presence-card'>
            <Container className='dashboard-presence-header'>
                <Title className='font-size-3 color-primary font-weight-5'>{selectedTeam.name}</Title>
                <Button
                    variant='ghost'
                    intent='neutral'
                    size='sm'
                    onClick={() => navigate('/dashboard/my-team')}
                    rightIcon={<GoArrowRight size={12} />}
                >
                    Manage team
                </Button>
            </Container>

            {totalCount === 0 ? (
                <Container className='dashboard-presence-empty d-flex flex-center flex-1'>
                    <Users size={20} strokeWidth={1.5} className='color-muted' />
                    <span className='color-muted font-size-2'>No members yet</span>
                </Container>
            ) : (
                <Container className='dashboard-presence-grid'>
                    {allSorted.map(({ user, memberId }) => {
                        const isOnline = resolveTeamUserOnline(user, onlineUserIds, hasPresenceSnapshot);
                        return (
                            <Container
                                key={memberId}
                                className='dashboard-presence-member d-flex column items-center gap-025'
                                title={`${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email}
                            >
                                <Avatar
                                    user={user}
                                    size='sm'
                                    showStatus
                                    isOnline={isOnline}
                                />
                                <span className={`font-size-1 text-truncate dashboard-presence-name ${isOnline ? 'color-primary' : 'color-muted'}`}>
                                    {user.firstName ?? user.email?.split('@')[0] ?? '?'}
                                </span>
                            </Container>
                        );
                    })}
                </Container>
            )}

            <Container className='dashboard-presence-footer'>
                <span className='dashboard-presence-count font-size-1 font-weight-5'>
                    {onlineCount} online
                </span>
                <span className='font-size-1 color-muted'>/ {totalCount}</span>
            </Container>
        </Container>
    );
};

export default DashboardTeamPresence;
