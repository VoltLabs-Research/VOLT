import useTeamMemberData from '@/modules/team/hooks/member/use-team-member-data';
import { useSelectedTeam } from '@/modules/team/hooks/team/use-selected-team';
import { useTeamPresenceStore } from '@/modules/team/store/team/use-team-presence-store';
import { resolveTeamUserOnline } from '@/modules/team/utils/member/presence';
import { Button, Skeleton, cn } from '@heroui/react';
import { Modal } from '@/shared/ui/modal/Modal';
import { closeModal } from '@/shared/ui/modal/use-modal-store';
import UserAvatar from '@/modules/auth/components/UserAvatar';
import RecoveryState, { RecoveryStateTone } from '@/shared/ui/components/RecoveryState';
import { getTeamOwnerContactHint, toPermissionLabels } from '@/modules/dashboard/utils/access-denied-hints';
import { DASHBOARD_DRAWER_IDS } from '@/modules/dashboard/store/use-jobs-drawer-store';
import { useMemo } from 'react';
import { ArrowRight, Users } from 'lucide-react';
import type { ReactNode } from 'react';
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
            className='min-h-full'
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
            className='min-h-full'
        />
    );

    const loadingState = (
        <div className='flex flex-row flex-wrap items-center gap-2'>
            {Array.from({ length: 8 }, (_, i) => (
                <Skeleton key={i} className='size-8 shrink-0 rounded-full' aria-hidden='true' />
            ))}
        </div>
    );

    const emptyState = (
        <RecoveryState
            className='flex-1'
            icon={<Users size={20} strokeWidth={1.5} className='text-muted' />}
            title='No members yet'
            description='Invite teammates to start seeing who is active and available across your workspace.'
        />
    );

    if (!selectedTeam) {
        return null;
    }

    let presenceContent: ReactNode = (
        <div className='flex min-h-0 flex-1 flex-wrap content-start gap-3 overflow-y-auto'>
            {sortedMembers.map(({ user, memberId, isOnline }) => {
                const title = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email;
                const displayName = user.firstName ?? user.email?.split('@')[0] ?? '?';

                return (
                    <div className='flex w-[52px] flex-col items-center gap-1' key={memberId} title={title}>
                        <UserAvatar
                            user={user}
                            size='sm'
                            showStatus
                            isOnline={isOnline}
                        />
                        <span className={cn('max-w-[52px] truncate text-center text-xs leading-[1.2]', isOnline ? 'text-foreground' : 'text-muted')}>
                            {displayName}
                        </span>
                    </div>
                );
            })}
        </div>
    );

    if (accessDenied) {
        presenceContent = accessDeniedState;
    } else if (error) {
        presenceContent = renderErrorState(error);
    } else if (isLoading) {
        presenceContent = loadingState;
    } else if (totalCount === 0) {
        presenceContent = emptyState;
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
                    size='sm'
                    onPress={goToTeam}
                >
                    Manage team
                    <ArrowRight size={12} aria-hidden='true' />
                </Button>
            )}
        >
            <div className='flex h-full min-h-0 flex-col p-6'>
                {presenceContent}
            </div>
        </Modal>
    );
};

export default PresenceDrawer;
