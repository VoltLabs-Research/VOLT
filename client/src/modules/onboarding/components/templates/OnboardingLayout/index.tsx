import './OnboardingLayout.css';
import { useCurrentUser } from '@/modules/auth/hooks/use-current-user';
import { refreshSocketSession } from '@/modules/socket/core/services/socket-auth-session';
import { JoinTeamModal } from '@/modules/team/components/organisms/JoinTeamModal';
import { switchSelectedTeam } from '@/modules/team/stores/team/use-team-store';
import UserMenuPopover from '@/modules/auth/components/molecules/UserMenuPopover';
import NotificationsPopover from '@/modules/notification/components/organisms/NotificationsPopover';
import { openModal } from '@/shared/presentation/components/Modal';
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
    const contentClassNames = ['onboarding-layout__content'];

    const handleJoinTeamSuccess = async ({ teamId }: JoinByInviteCodeOutputDTO) => {
        switchSelectedTeam(teamId);
        await refreshSocketSession();
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
