import './DashboardTeamPresence.css';
import DashboardCard from '@/modules/dashboard/components/atoms/DashboardCard';
import useTeamMemberData from '@/modules/team/hooks/member/use-team-member-data';
import { useSelectedTeam } from '@/modules/team/hooks/team/use-selected-team';
import { useTeamPresenceStore } from '@/modules/team/stores/team/use-team-presence-store';
import { resolveTeamUserOnline } from '@/modules/team/utilities/member/presence';
import Avatar from '@/shared/presentation/components/Avatar';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import EmptyState from '@/shared/presentation/components/EmptyState';
import RecoveryState, { RecoveryStateTone } from '@/shared/presentation/components/RecoveryState';
import Title from '@/shared/presentation/components/Title';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@mui/material';
import { Users } from 'lucide-react';
import { GoArrowRight } from 'react-icons/go';
import type { User } from '@/modules/auth/api/entities/user';

interface TeamPresenceMember {
    user: User;
    memberId: string;
};

const DashboardTeamPresence = () => {
    const navigate = useNavigate();
    const selectedTeam = useSelectedTeam();
    const selectedTeamId = selectedTeam?._id;
    const { members, isLoading, error, accessDenied, accessDeniedMessage, refresh } = useTeamMemberData({ teamId: selectedTeamId });
    const onlineUserIds = useTeamPresenceStore((s) => s.onlineUserIds);
    const hasPresenceSnapshot = useTeamPresenceStore((s) => s.hasPresenceSnapshot);

    const { onlineMembers, offlineMembers } = useMemo(() => {
        const online: TeamPresenceMember[] = [];
        const offline: TeamPresenceMember[] = [];

        for (const member of members) {
            const user = member.user;
            if (!user._id) continue;

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

    if (!selectedTeam) {
        return null;
    }

    if (accessDenied) {
        return (
            <DashboardCard className='dashboard-presence-card d-flex column'>
                <RecoveryState
                    title='Access denied'
                    description={accessDeniedMessage ?? 'You do not have permission to view team presence.'}
                    tone={RecoveryStateTone.AccessDenied}
                    className='dashboard-card-state'
                />
            </DashboardCard>
        );
    }

    if (error) {
        return (
            <DashboardCard className='dashboard-presence-card d-flex column'>
                <RecoveryState
                    title='Unable to load team presence'
                    description={error}
                    tone={RecoveryStateTone.Error}
                    onRetry={() => {
                        refresh().catch(() => undefined);
                    }}
                    className='dashboard-card-state'
                />
            </DashboardCard>
        );
    }

    if (isLoading) {
        return (
            <DashboardCard className='dashboard-presence-card d-flex column'>
                <Container className='dashboard-presence-header'>
                    <Title className='font-size-3 color-primary font-weight-5'>{selectedTeam.name}</Title>
                </Container>
                <Container className='d-flex items-center gap-05' style={{ flexWrap: 'wrap' }}>
                    {Array.from({ length: 5 }, (_, i) => (
                        <Skeleton key={i} variant='circular' width={32} height={32} />
                    ))}
                </Container>
            </DashboardCard>
        );
    }

    const allSorted = [...onlineMembers, ...offlineMembers];
    let membersContent = (
        <Container className='dashboard-presence-grid'>
            {allSorted.map(({ user, memberId }) => {
                const isOnline = resolveTeamUserOnline(user, onlineUserIds, hasPresenceSnapshot);
                const title = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email;
                const displayName = user.firstName ?? user.email?.split('@')[0] ?? '?';
                let nameClassName = 'font-size-1 text-truncate dashboard-presence-name color-muted';
                if (isOnline) {
                    nameClassName = 'font-size-1 text-truncate dashboard-presence-name color-primary';
                }

                return (
                    <Container
                        key={memberId}
                        className='dashboard-presence-member d-flex column items-center gap-025'
                        title={title}
                    >
                        <Avatar
                            user={user}
                            size='sm'
                            showStatus
                            isOnline={isOnline}
                        />
                        <span className={nameClassName}>
                            {displayName}
                        </span>
                    </Container>
                );
            })}
        </Container>
    );

    if (totalCount === 0) {
        membersContent = (
            <EmptyState
                className='dashboard-presence-empty flex-1'
                icon={<Users size={20} strokeWidth={1.5} className='color-muted' />}
                title='No members yet'
                description='Invite teammates to start seeing who is active and available across your workspace.'
            />
        );
    }

    return (
        <DashboardCard className='dashboard-presence-card d-flex column'>
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

            {membersContent}

            <Container className='dashboard-presence-footer'>
                <span className='dashboard-presence-count font-size-1 font-weight-5'>
                    {onlineCount} online
                </span>
                <span className='font-size-1 color-muted'>/ {totalCount}</span>
            </Container>
        </DashboardCard>
    );
};

export default DashboardTeamPresence;
