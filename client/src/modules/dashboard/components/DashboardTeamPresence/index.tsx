import './DashboardTeamPresence.css';
import DashboardCard from '@/modules/dashboard/components/DashboardCard';
import useTeamMemberData from '@/modules/team/hooks/member/use-team-member-data';
import { useSelectedTeam } from '@/modules/team/hooks/team/use-selected-team';
import { useTeamPresenceStore } from '@/modules/team/stores/team/use-team-presence-store';
import { resolveTeamUserOnline } from '@/modules/team/utilities/member/presence';
import AsyncBoundary from '@/shared/presentation/primitives/AsyncBoundary';
import Avatar from '@/shared/presentation/primitives/Avatar';
import Box from '@/shared/presentation/primitives/Box';
import Button from '@/shared/presentation/primitives/Button';
import Heading from '@/shared/presentation/primitives/Heading';
import Row from '@/shared/presentation/primitives/Row';
import Skeleton from '@/shared/presentation/primitives/Skeleton';
import Stack from '@/shared/presentation/primitives/Stack';
import Text from '@/shared/presentation/primitives/Text';
import EmptyState from '@/shared/presentation/primitives/EmptyState';
import RecoveryState, { RecoveryStateTone } from '@/shared/presentation/components/RecoveryState';
import { useMemo } from 'react';
import { Users } from 'lucide-react';
import { GoArrowRight } from 'react-icons/go';
import type { User } from '@/modules/auth/api/entities/user';
import { useNavigate } from 'react-router-dom';
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

    const accessDeniedState = (
        <RecoveryState
            title='Access denied'
            description={accessDeniedMessage ?? 'You do not have permission to view team presence.'}
            tone={RecoveryStateTone.AccessDenied}
            className='dashboard-card-state'
        />
    );

    const renderErrorState = (err: unknown) => (
        <RecoveryState
            title='Unable to load team presence'
            description={typeof err === 'string' ? err : 'Unknown error'}
            tone={RecoveryStateTone.Error}
            onRetry={() => {
                refresh().catch(() => undefined);
            }}
            className='dashboard-card-state'
        />
    );

    const loadingState = (
        <>
            <Box className='dashboard-presence-header'>
                <Heading level={3} size='lg' tone='primary' weight='medium'>{selectedTeam.name}</Heading>
            </Box>
            <Row gap='05' style={{ flexWrap: 'wrap' }}>
                {Array.from({ length: 5 }, (_, i) => (
                    <Skeleton key={i} variant='circular' width={32} height={32} />
                ))}
            </Row>
        </>
    );

    const allSorted = [...onlineMembers, ...offlineMembers];
    const emptyState = (
        <>
            <Box className='dashboard-presence-header'>
                <Heading level={3} size='lg' tone='primary' weight='medium'>{selectedTeam.name}</Heading>
                <Button
                    variant='ghost'
                    intent='neutral'
                    size='sm'
                    onClick={() => navigate('/dashboard/my-team')}
                    rightIcon={<GoArrowRight size={12} />}
                >
                    Manage team
                </Button>
            </Box>
            <EmptyState
                className='dashboard-presence-empty flex-1'
                icon={<Users size={20} strokeWidth={1.5} className='color-muted' />}
                title='No members yet'
                description='Invite teammates to start seeing who is active and available across your workspace.'
            />
            <Box className='dashboard-presence-footer'>
                <Text size='sm' weight='medium' className='dashboard-presence-count'>
                    {onlineCount} online
                </Text>
                <Text size='sm' tone='muted'>/ {totalCount}</Text>
            </Box>
        </>
    );

    return (
        <DashboardCard className='dashboard-presence-card d-flex column'>
            <AsyncBoundary
                state={{
                    loading: isLoading,
                    error: error || undefined,
                    accessDenied,
                    empty: totalCount === 0
                }}
                loading={loadingState}
                error={renderErrorState}
                accessDenied={accessDeniedState}
                empty={emptyState}
            >
                <Box className='dashboard-presence-header'>
                    <Heading level={3} size='lg' tone='primary' weight='medium'>{selectedTeam.name}</Heading>
                    <Button
                        variant='ghost'
                        intent='neutral'
                        size='sm'
                        onClick={() => navigate('/dashboard/my-team')}
                        rightIcon={<GoArrowRight size={12} />}
                    >
                        Manage team
                    </Button>
                </Box>

                <Box className='dashboard-presence-grid'>
                    {allSorted.map(({ user, memberId }) => {
                        const isOnline = resolveTeamUserOnline(user, onlineUserIds, hasPresenceSnapshot);
                        const title = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email;
                        const displayName = user.firstName ?? user.email?.split('@')[0] ?? '?';
                        let nameClassName = 'font-size-1 text-truncate dashboard-presence-name color-muted';
                        if (isOnline) {
                            nameClassName = 'font-size-1 text-truncate dashboard-presence-name color-primary';
                        }

                        return (
                            <Stack key={memberId} align='center' gap='025' className='dashboard-presence-member' title={title}>
                                <Avatar
                                    user={user}
                                    size='sm'
                                    showStatus
                                    isOnline={isOnline}
                                />
                                <span className={nameClassName}>
                                    {displayName}
                                </span>
                            </Stack>
                        );
                    })}
                </Box>

                <Box className='dashboard-presence-footer'>
                    <Text size='sm' weight='medium' className='dashboard-presence-count'>
                        {onlineCount} online
                    </Text>
                    <Text size='sm' tone='muted'>/ {totalCount}</Text>
                </Box>
            </AsyncBoundary>
        </DashboardCard>
    );
};

export default DashboardTeamPresence;
