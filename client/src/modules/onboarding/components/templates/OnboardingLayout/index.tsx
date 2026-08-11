import { useCurrentUser } from '@/modules/auth/hooks/use-current-user';
import { refreshSocketSession } from '@/modules/socket/services/socket-auth-session';
import { JoinTeamModal } from '@/modules/team/components/JoinTeamModal';
import { switchSelectedTeam } from '@/modules/team/store/team/use-team-store';
import UserMenuPopover from '@/modules/auth/components/UserMenuPopover';
import NotificationsPopover from '@/modules/notification/components/NotificationsPopover';
import { Button } from '@heroui/react';
import { openModal } from '@/shared/ui/modal/use-modal-store';
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
        <div className='relative min-h-dvh overflow-hidden bg-background'>
            <main className='relative z-0 grid items-center justify-items-center h-screen min-h-0 overflow-hidden pt-[calc(max(1rem,env(safe-area-inset-top,0px))_+_4.5rem)] pr-[calc(max(1rem,env(safe-area-inset-right,0px))_+_1.5rem)] pb-[calc(max(1rem,env(safe-area-inset-bottom,0px))_+_4.5rem)] pl-[calc(max(1rem,env(safe-area-inset-left,0px))_+_1.5rem)] max-[768px]:items-start max-[768px]:pt-[calc(max(1rem,env(safe-area-inset-top,0px))_+_5rem)] max-[768px]:pr-[calc(max(1rem,env(safe-area-inset-right,0px))_+_0.75rem)] max-[768px]:pb-[calc(max(1rem,env(safe-area-inset-bottom,0px))_+_5.5rem)] max-[768px]:pl-[calc(max(1rem,env(safe-area-inset-left,0px))_+_0.75rem)]'>
                {children}
            </main>

            {overlay && (
                <div className='fixed inset-0 z-[1] pointer-events-none [&>*]:pointer-events-auto'>
                    {overlay}
                </div>
            )}

            {leftSlot && (
                <div className='fixed z-[2] top-[calc(max(1rem,env(safe-area-inset-top,0px))_+_0.5rem)] left-[calc(max(1rem,env(safe-area-inset-left,0px))_+_0.5rem)] max-w-[min(100%_-_3rem,24rem)] max-[768px]:top-[calc(max(1rem,env(safe-area-inset-top,0px))_+_0.25rem)] max-[768px]:left-[calc(max(1rem,env(safe-area-inset-left,0px))_+_0.25rem)] max-[768px]:max-w-[calc(100vw_-_8rem)]'>
                    {leftSlot}
                </div>
            )}

            <Button
                className='fixed z-[2] top-[max(1rem,env(safe-area-inset-top,0px))] right-[max(1rem,env(safe-area-inset-right,0px))] max-[768px]:min-h-10 max-[768px]:px-3.5'
                variant='ghost'
                size='sm'
                onPress={() => openModal('join-team-modal')}
            >
                Have an invite code?
            </Button>

            {user && (
                <div className='fixed z-[2] bottom-[max(1rem,env(safe-area-inset-bottom,0px))] left-[max(1rem,env(safe-area-inset-left,0px))]'>
                    <UserMenuPopover
                        onSettingsClick={onSettingsClick}
                        onSignOut={onSignOut}
                        isSigningOut={isSigningOut}
                    />
                </div>
            )}

            <div className='fixed z-[2] right-[max(1rem,env(safe-area-inset-right,0px))] bottom-[max(1rem,env(safe-area-inset-bottom,0px))]'>
                <NotificationsPopover />
            </div>
            <JoinTeamModal onSuccess={handleJoinTeamSuccess} />
        </div>
    );
};

export default OnboardingLayout;
