import './OnboardingLayout.css';
import { useCurrentUser } from '@/modules/auth/hooks/use-current-user';
import { refreshSocketSession } from '@/modules/socket/core/services/socket-auth-session';
import { JoinTeamModal } from '@/modules/team/components/JoinTeamModal';
import { switchSelectedTeam } from '@/modules/team/stores/team/use-team-store';
import UserMenuPopover from '@/modules/auth/components/UserMenuPopover';
import NotificationsPopover from '@/modules/notification/components/NotificationsPopover';
import { Button, openModal } from '@/shared/presentation/primitives';
import type { ReactNode } from 'react';
import type { JoinByInviteCodeOutputDTO } from '@/modules/team/api/dtos/team/join-by-invite-code';

interface OnboardingLayoutProps {
    children: ReactNode;
    onSettingsClick?: () => void;
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
        <div className='onboarding-layout screen-vh'>
            <main className={contentClassNames.join(' ')}>
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
                        onSettingsClick={onSettingsClick ?? (() => {})}
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
