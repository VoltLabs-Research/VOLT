import './OnboardingLayout.css';
import { TeamClusterStatus } from '@/modules/cluster/api/entities/team-cluster';
import { teamClustersQuery } from '@/modules/cluster/hooks/team-cluster/queries';
import { useCurrentUser } from '@/modules/auth/hooks/use-current-user';
import { refreshSocketSession } from '@/modules/socket/core/services/socket-auth-session';
import { JoinTeamModal } from '@/modules/team/components/organisms/JoinTeamModal';
import { TEAM_QUERY_KEYS } from '@/modules/team/hooks/team/queries';
import { useTeamStore } from '@/modules/team/stores/team/use-team-store';
import { openModal } from '@/shared/presentation/components/Modal';
import { useNavigate } from 'react-router-dom';
import UserMenuPopover from '@/modules/auth/components/molecules/UserMenuPopover';
import NotificationsPopover from '@/modules/notification/components/organisms/NotificationsPopover';
import teamService from '@/modules/team/api/services/team';
import queryClient from '@/shared/infrastructure/query/query-client';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import type { ReactNode } from 'react';
import type { JoinByInviteCodeOutputDTO } from '@/modules/team/api/dtos/team/join-by-invite-code';

interface OnboardingLayoutProps {
    children: ReactNode;
    onSettingsClick: () => void;
    onSignOut: () => void;
    isSigningOut?: boolean;
    leftSlot?: ReactNode;
    overlay?: ReactNode;
    contentClassName?: string;
};

const OnboardingLayout = ({
    children,
    onSettingsClick,
    onSignOut,
    isSigningOut = false,
    leftSlot,
    overlay,
    contentClassName
}: OnboardingLayoutProps) => {
    const user = useCurrentUser();
    const navigate = useNavigate();
    const setSelectedTeamId = useTeamStore((state) => state.setSelectedTeamId);
    const contentClassNames = ['onboarding-layout__content'];

    const handleJoinTeamSuccess = async ({ teamId }: JoinByInviteCodeOutputDTO) => {
        try {
            await queryClient.invalidateQueries({ queryKey: TEAM_QUERY_KEYS.teams() });
            await queryClient.fetchQuery({
                queryKey: TEAM_QUERY_KEYS.teams(),
                queryFn: () => teamService.getAll({})
            });
        } catch {
            // Keep onboarding flow resilient even if the teams refresh fails.
        }

        setSelectedTeamId(teamId);
        await refreshSocketSession().catch(() => undefined);

        try {
            const clusters = await teamClustersQuery.fetch(teamId, { staleTime: 0 });
            const hasConnectedCluster = clusters.data.some((cluster) => cluster.status === TeamClusterStatus.Connected);

            if (hasConnectedCluster) {
                navigate('/dashboard', { replace: true });
            }
        } catch {
            // If cluster verification fails, continue with the normal onboarding flow.
        }
    };

    if (contentClassName) {
        contentClassNames.push(contentClassName);
    }

    return (
        <Container className='onboarding-layout'>
            <main className={contentClassNames.join(' ')}>
                {children}
            </main>

            {overlay && (
                <Container className='onboarding-layout__overlay'>
                    {overlay}
                </Container>
            )}

            {leftSlot && (
                <Container className='onboarding-layout__left-slot'>
                    {leftSlot}
                </Container>
            )}

            <Button
                className='onboarding-layout__invite-btn'
                variant='ghost'
                intent='neutral'
                size='sm'
                onClick={() => openModal('join-team-modal')}
            >
                Have an invite code?
            </Button>

            {user && (
                <Container className='onboarding-layout__user-menu'>
                    <UserMenuPopover
                        onSettingsClick={onSettingsClick}
                        onSignOut={onSignOut}
                        isSigningOut={isSigningOut}
                    />
                </Container>
            )}

            <Container className='onboarding-layout__notifications'>
                <NotificationsPopover />
            </Container>

            <JoinTeamModal onSuccess={handleJoinTeamSuccess} />
        </Container>
    );
};

export default OnboardingLayout;
