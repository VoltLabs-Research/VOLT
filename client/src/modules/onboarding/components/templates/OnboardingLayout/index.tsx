import { useCurrentUser } from '@/modules/auth/hooks/use-current-user';
import { refreshSocketSession } from '@/modules/socket/services/socket-auth-session';
import { JoinTeamModal } from '@/modules/team/components/JoinTeamModal';
import { switchSelectedTeam } from '@/modules/team/store/team/use-team-store';
import UserMenuPopover from '@/modules/auth/components/UserMenuPopover';
import NotificationsPopover from '@/modules/notification/components/NotificationsPopover';
import { Button } from '@heroui/react';
import { openModal } from '@/shared/ui/modal';
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

/**
 * The nine `--onboarding-layout-*` custom properties this file used to declare were
 * read only by itself, so they are inlined here. Every inset is
 * `max(1rem, env(safe-area-inset-*))`: a hard 1rem margin on a desktop window, the
 * notch or home bar's own inset when that is larger.
 *
 * The content pane reserves 4.5rem top and bottom (5rem / 5.5rem on a phone, where
 * the fixed chrome is taller) so the centred card never sits under the invite button
 * or the user menu.
 */
const CONTENT_CLASS_NAMES = [
    'relative z-0 grid items-center justify-items-center h-screen min-h-0 overflow-hidden',
    'pt-[calc(max(1rem,env(safe-area-inset-top,0px))_+_4.5rem)]',
    'pr-[calc(max(1rem,env(safe-area-inset-right,0px))_+_1.5rem)]',
    'pb-[calc(max(1rem,env(safe-area-inset-bottom,0px))_+_4.5rem)]',
    'pl-[calc(max(1rem,env(safe-area-inset-left,0px))_+_1.5rem)]',
    'max-[768px]:items-start',
    'max-[768px]:pt-[calc(max(1rem,env(safe-area-inset-top,0px))_+_5rem)]',
    'max-[768px]:pr-[calc(max(1rem,env(safe-area-inset-right,0px))_+_0.75rem)]',
    'max-[768px]:pb-[calc(max(1rem,env(safe-area-inset-bottom,0px))_+_5.5rem)]',
    'max-[768px]:pl-[calc(max(1rem,env(safe-area-inset-left,0px))_+_0.75rem)]'
].join(' ');

/** The overlay itself is inert; only what a caller puts inside it takes the pointer. */
const OVERLAY_CLASS_NAMES = 'fixed inset-0 z-[1] pointer-events-none [&>*]:pointer-events-auto';

const LEFT_SLOT_CLASS_NAMES = [
    'fixed z-[2]',
    'top-[calc(max(1rem,env(safe-area-inset-top,0px))_+_0.5rem)]',
    'left-[calc(max(1rem,env(safe-area-inset-left,0px))_+_0.5rem)]',
    'max-w-[min(100%_-_3rem,24rem)]',
    'max-[768px]:top-[calc(max(1rem,env(safe-area-inset-top,0px))_+_0.25rem)]',
    'max-[768px]:left-[calc(max(1rem,env(safe-area-inset-left,0px))_+_0.25rem)]',
    'max-[768px]:max-w-[calc(100vw_-_8rem)]'
].join(' ');

const INVITE_BUTTON_CLASS_NAMES = [
    'fixed z-[2]',
    'top-[max(1rem,env(safe-area-inset-top,0px))]',
    'right-[max(1rem,env(safe-area-inset-right,0px))]',
    'max-[768px]:min-h-10 max-[768px]:px-3.5'
].join(' ');

const USER_MENU_CLASS_NAMES = 'fixed z-[2] bottom-[max(1rem,env(safe-area-inset-bottom,0px))] left-[max(1rem,env(safe-area-inset-left,0px))]';

const NOTIFICATIONS_CLASS_NAMES = 'fixed z-[2] right-[max(1rem,env(safe-area-inset-right,0px))] bottom-[max(1rem,env(safe-area-inset-bottom,0px))]';

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
            <main className={CONTENT_CLASS_NAMES}>
                {children}
            </main>

            {overlay && (
                <div className={OVERLAY_CLASS_NAMES}>
                    {overlay}
                </div>
            )}

            {leftSlot && (
                <div className={LEFT_SLOT_CLASS_NAMES}>
                    {leftSlot}
                </div>
            )}

            <Button
                className={INVITE_BUTTON_CLASS_NAMES}
                variant='ghost'
                size='sm'
                onPress={() => openModal('join-team-modal')}
            >
                Have an invite code?
            </Button>

            {user && (
                <div className={USER_MENU_CLASS_NAMES}>
                    <UserMenuPopover
                        onSettingsClick={onSettingsClick}
                        onSignOut={onSignOut}
                        isSigningOut={isSigningOut}
                    />
                </div>
            )}

            <div className={NOTIFICATIONS_CLASS_NAMES}>
                <NotificationsPopover />
            </div>

            <JoinTeamModal onSuccess={handleJoinTeamSuccess} />
        </div>
    );
};

export default OnboardingLayout;
