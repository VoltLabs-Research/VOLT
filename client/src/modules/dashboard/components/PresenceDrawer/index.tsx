import './PresenceDrawer.css';
import useTeamMemberData from '@/modules/team/hooks/member/use-team-member-data';
import { useSelectedTeam } from '@/modules/team/hooks/team/use-selected-team';
import { useTeamPresenceStore } from '@/modules/team/store/team/use-team-presence-store';
import { resolveTeamUserOnline } from '@/modules/team/utils/member/presence';
import { AsyncBoundary, Avatar, Box, Button, Modal, Row, Skeleton, Stack, EmptyState, closeModal } from '@voltstack/bravais';
import RecoveryState, { RecoveryStateTone } from '@/shared/ui/components/RecoveryState';
import { getTeamOwnerContactHint, toPermissionLabels } from '@/modules/dashboard/utils/access-denied-hints';
import { DASHBOARD_DRAWER_IDS } from '@/modules/dashboard/store/use-jobs-drawer-store';
import { useMemo } from 'react';
import { Users } from 'lucide-react';
import { GoArrowRight } from 'react-icons/go';
import type { User } from '@volt/contracts/modules/auth/domain';
import { useNavigate } from 'react-router-dom';

interface TeamPresenceMember {
    user: User;
    memberId: string;
    isOnline: boolean;
}

const PresenceDrawer = () => {
    const navigate = useNavigate();
    const selectedTeam = useSelectedTeam();
    const selectedTeamId = selectedTeam?._id;
    const { members, isLoading, error, accessDenied, accessDeniedMessage, refresh } = useTeamMemberData({ teamId: selectedTeamId });
    const onlineUserIds = useTeamPresenceStore((s) => s.onlineUserIds);
    const hasPresenceSnapshot = useTeamPresenceStore((s) => s.hasPresenceSnapshot);

    const { sortedMembers, onlineCount } = useMemo(() => {
        const online: TeamPresenceMember[] = [];
        const offline: TeamPresenceMember[] = [];

        for (const member of members) {
            const isOnline = resolveTeamUserOnline(member.user, onlineUserIds, hasPresenceSnapshot);

            (isOnline ? online : offline).push({
                user: member.user,
                memberId: member._id,
                isOnline
            });
        }

        return {
            sortedMembers: [...online, ...offline],
            onlineCount: online.length
        };
    }, [members, onlineUserIds, hasPresenceSnapshot]);

    const totalCount = members.length;

    const goToTeam = () => {
        closeModal(DASHBOARD_DRAWER_IDS.presence);
        navigate('/dashboard/my-team');
    };

    const accessDeniedState = (
        <RecoveryState
            title='Access denied'
            description={accessDeniedMessage ?? 'You do not have permission to view team presence.'}
            tone={RecoveryStateTone.AccessDenied}
            requiredPermissions={toPermissionLabels(['team-member:read'])}
            contactHint={getTeamOwnerContactHint(selectedTeam)}
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
        <Row gap='05' style={{ flexWrap: 'wrap' }}>
            {Array.from({ length: 8 }, (_, i) => (
                <Skeleton key={i} variant='circular' width={32} height={32} />
            ))}
        </Row>
    );

    const emptyState = (
        <EmptyState
            className='dashboard-presence-empty flex-1'
            icon={<Users size={20} strokeWidth={1.5} className='color-muted' />}
            title='No members yet'
            description='Invite teammates to start seeing who is active and available across your workspace.'
        />
    );

    if (!selectedTeam) {
        return null;
    }

    return (
        <Modal
            id={DASHBOARD_DRAWER_IDS.presence}
            placement='right'
            title={selectedTeam.name}
            description={`${onlineCount} online / ${totalCount}`}
            lazyMount
            footer={(
                <Button
                    variant='ghost'
                    intent='neutral'
                    size='sm'
                    onClick={goToTeam}
                    rightIcon={<GoArrowRight size={12} />}
                >
                    Manage team
                </Button>
            )}
        >
            <Box className='dashboard-presence-drawer'>
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
                    <Box className='dashboard-presence-grid'>
                        {sortedMembers.map(({ user, memberId, isOnline }) => {
                            const title = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email;
                            const displayName = user.firstName ?? user.email?.split('@')[0] ?? '?';

                            return (
                                <Stack key={memberId} align='center' gap='025' className='dashboard-presence-member' title={title}>
                                    <Avatar
                                        user={user}
                                        size='sm'
                                        showStatus
                                        isOnline={isOnline}
                                    />
                                    <span className={`font-size-1 text-truncate dashboard-presence-name ${isOnline ? 'color-primary' : 'color-muted'}`}>
                                        {displayName}
                                    </span>
                                </Stack>
                            );
                        })}
                    </Box>
                </AsyncBoundary>
            </Box>
        </Modal>
    );
};

export default PresenceDrawer;
