import './OnboardingLayout.css';
import { useCurrentUser } from '@/modules/auth/hooks/use-current-user';
import UserMenuPopover from '@/modules/auth/components/molecules/UserMenuPopover';
import NotificationsPopover from '@/modules/notification/components/organisms/NotificationsPopover';
import { JoinTeamModal } from '@/modules/team/components/organisms/JoinTeamModal';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import { openModal } from '@/shared/presentation/components/Modal';
import type { ReactNode } from 'react';

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

    if (contentClassName) {
        contentClassNames.push(contentClassName);
    }

    return (
        <Container className='onboarding-layout'>
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

            <Container className={contentClassNames.join(' ')}>
                {children}
            </Container>

            {overlay}

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

            <JoinTeamModal />
        </Container>
    );
};

export default OnboardingLayout;
