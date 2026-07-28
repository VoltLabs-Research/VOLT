import './OnboardingLayout.css';
import { useCurrentUser } from '@/modules/auth/hooks/use-current-user';
import { refreshSocketSession } from '@/modules/socket/services/socket-auth-session';
import { JoinTeamModal } from '@/modules/team/components/JoinTeamModal';
import { switchSelectedTeam } from '@/modules/team/store/team/use-team-store';
import UserMenuPopover from '@/modules/auth/components/UserMenuPopover';
import NotificationsPopover from '@/modules/notification/components/NotificationsPopover';
import { Button, openModal } from '@voltstack/bravais';
import type { ReactNode } from 'react';
import type { JoinByInviteCodeResponse } from '@/modules/team/api/services/team-service';

interface OnboardingLayoutProps {
    children: ReactNode;
    onSettingsClick: () => void;
    onSignOut: () => void;
    isSigningOut?: boolean;
    leftSlot?: ReactNode;
    overlay?: ReactNode;
};

const OnboardingLayout = ({
    children,
    onSettingsClick,
    onSignOut,
    isSigningOut = false,
    leftSlot,
    overlay
}: OnboardingLayoutProps) => {
    const user = useCurrentUser();

    const handleJoinTeamSuccess = async ({ teamId }: JoinByInviteCodeResponse) => {
        switchSelectedTeam(teamId);
        await refreshSocketSession();
    };

    return (
        <div className='onboarding-layout screen-vh'>
            <main className='onboarding-layout__content'>
                {children}
            </main>

            {overlay && (
                <div className='onboarding-layout__overlay'>
                    {overlay}
                </div>
            )}

            {leftSlot && (
                <div className='onboarding-layout__left-slot'>
                    {leftSlot}
                </div>
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
                <div className='onboarding-layout__user-menu'>
                    <UserMenuPopover
                        onSettingsClick={onSettingsClick}
                        onSignOut={onSignOut}
                        isSigningOut={isSigningOut}
                    />
                </div>
            )}

            <div className='onboarding-layout__notifications'>
                <NotificationsPopover />
            </div>

            <JoinTeamModal onSuccess={handleJoinTeamSuccess} />
        </div>
    );
};

export default OnboardingLayout;
