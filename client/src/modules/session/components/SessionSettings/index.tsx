import {
    REVOKE_ALL_MODAL_ID
} from '@/modules/session/hooks/use-session-data';
import {
    formatSessionRelativeTime,
    getSessionActivityIcon,
    parseSessionUserAgent,
    SESSION_ACTION_LABELS
} from '@/modules/session/utils/session-display';
import SettingsPage from '@/shared/ui/components/SettingsPage';
import { Button, Skeleton, cn } from '@heroui/react';
import { Modal } from '@/shared/ui/modal';
import ModalFooterActions from '@/shared/ui/components/ModalFooterActions';
import RecoveryState from '@/shared/ui/components/RecoveryState';
import SettingsSectionHeader from '@/shared/ui/components/SettingsSectionHeader';
import useSessionData from '@/modules/session/hooks/use-session-data';
import useTip from '@/shared/tips/use-tip';
import { Clock, Monitor, Shield, Smartphone } from 'lucide-react';
import { SessionActivityType } from '@volt/contracts/modules/session/domain';
import type { ActiveSession, LoginActivityEntry } from '@volt/contracts/modules/session/domain';
import type { ReactNode } from 'react';

/**
 * A session row is a three-column grid — icon, body, action — and `group` is
 * load-bearing: the revoke button hides itself and the row reveals it.
 *
 * The reveal is scoped to `(hover: hover)` exactly as the stylesheet it replaces
 * scoped it, so on a touch device the button is simply always visible rather than
 * needing a hover that will never arrive. Repeating the media query on the
 * reveal — instead of leaving a bare `group-hover:opacity-100` outside it — is
 * what makes the pair order-independent: inside one media block the descendant
 * selector out-specifies the base, so it wins no matter how Tailwind sorts them.
 */
const ROW = 'group grid grid-cols-[auto_1fr_auto] gap-x-[0.875rem] items-start px-3 py-4 rounded-xl transition-colors duration-150 hover:bg-surface-tertiary focus-within:bg-surface-tertiary';

const ROW_ACTION = 'self-start shrink-0 text-danger [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:transition-opacity [@media(hover:hover)]:duration-[120ms] [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:opacity-100';

const ROW_TITLE = 'text-[0.9375rem] font-medium text-foreground leading-[1.2] truncate';

const ROW_LINE = 'text-[0.8125rem] text-muted leading-[1.2] tabular-nums';

/**
 * `origin-[0_55%] scale-y-60` reproduces bravais's `variant='text'` skeleton,
 * whose transform painted a bar at 60% of the height it reserved. Without it
 * these bars keep their box but fill it, which reads as content rather than as a
 * placeholder.
 */
const ROW_SKELETON_TEXT = 'rounded-md origin-[0_55%] scale-y-60';

const getActivityIconToneClass = (action: SessionActivityType, success: boolean): string => {
    if (!success) return 'text-danger';
    if (action === SessionActivityType.OAuthLogin) return 'text-foreground';
    if (action === SessionActivityType.PasswordUpdate) return 'text-warning';
    if (action === SessionActivityType.Login) return 'text-success';
    return 'text-muted';
};

const SessionSettings = () => {
    useTip('session-management');

    const {
        activities,
        closeRevokeAllSessionsModal,
        isRevoking,
        loadingActivity,
        loadingSessions,
        openRevokeAllSessionsModal,
        otherSessionsCount,
        revokeAllOtherSessions,
        revokeSession,
        sessions
    } = useSessionData();

    const renderSession = (session: ActiveSession) => {
        const DeviceIcon = session.isMobile ? Smartphone : Monitor;

        return (
            <li key={session._id} className={ROW}>
                <DeviceIcon size={16} className='shrink-0 mt-[0.1875rem] text-muted' />
                <div className='flex flex-col gap-[0.4375rem] min-w-0'>
                    <span className={ROW_TITLE}>{session.browser} on {session.os}</span>
                    <span className={ROW_LINE}>{session.ip}</span>
                    <span className={cn(ROW_LINE, session.isCurrent && 'text-foreground font-medium')}>
                        {session.isCurrent ? 'Current session' : formatSessionRelativeTime(session.lastActivity)}
                    </span>
                </div>
                {!session.isCurrent && (
                    <Button
                        variant='ghost'
                        size='sm'
                        onPress={() => { void revokeSession(session); }}
                        isDisabled={isRevoking}
                        className={ROW_ACTION}
                    >
                        Revoke
                    </Button>
                )}
            </li>
        );
    };

    const renderActivity = (activity: LoginActivityEntry) => {
        const { browser, os } = parseSessionUserAgent(activity.userAgent);
        const ActionIcon = getSessionActivityIcon(activity.action);
        const toneClass = getActivityIconToneClass(activity.action, activity.success);
        const actionLabel = activity.success
            ? SESSION_ACTION_LABELS[activity.action]
            : 'Failed sign-in';
        const ariaLabel = `${actionLabel} · ${browser} on ${os} · ${activity.ip}`;

        return (
            <li key={activity._id} className={ROW} aria-label={ariaLabel}>
                <ActionIcon size={16} className={cn('shrink-0 mt-[0.1875rem]', toneClass)} />
                <div className='flex flex-col gap-[0.4375rem] min-w-0'>
                    <span className={ROW_TITLE}>{browser} on {os}</span>
                    <span className={ROW_LINE}>{activity.ip}</span>
                    <span className={ROW_LINE}>
                        {formatSessionRelativeTime(activity.createdAt)}
                    </span>
                </div>
            </li>
        );
    };

    const renderRowSkeleton = (key: string) => (
        <li key={key} className={ROW}>
            <Skeleton animationType='pulse' className='size-4 rounded-xl' />
            <div className='flex flex-col gap-[0.4375rem] min-w-0'>
                <Skeleton animationType='pulse' className={cn(ROW_SKELETON_TEXT, 'h-[14px] w-[45%]')} />
                <Skeleton animationType='pulse' className={cn(ROW_SKELETON_TEXT, 'h-[12px] w-[30%]')} />
                <Skeleton animationType='pulse' className={cn(ROW_SKELETON_TEXT, 'h-[12px] w-[25%]')} />
            </div>
        </li>
    );

    let activeSessionsAction: ReactNode;
    if (otherSessionsCount > 0) {
        activeSessionsAction = (
            <Button
                variant='ghost'
                size='sm'
                className='text-danger'
                onPress={openRevokeAllSessionsModal}
            >
                Revoke all others
            </Button>
        );
    }

    const renderList = (content: ReactNode, isEmptyState: boolean) => (
        <div className={cn('max-h-[26rem] overflow-y-auto -mx-2 px-1', isEmptyState && 'max-h-none overflow-visible')}>
            <ul className='m-0 p-0 list-none flex flex-col gap-1'>
                {content}
            </ul>
        </div>
    );

    let sessionsContent: ReactNode;
    if (loadingSessions) {
        sessionsContent = Array.from({ length: 2 }).map((_, i) => renderRowSkeleton(`s-${i}`));
    } else if (sessions.length === 0) {
        sessionsContent = (
            <RecoveryState
                icon={<Shield size={24} />}
                title='No active sessions'
                description='There are no active sessions for your account.'
            />
        );
    } else {
        sessionsContent = sessions.map(renderSession);
    }

    let activityContent: ReactNode;
    if (loadingActivity) {
        activityContent = Array.from({ length: 3 }).map((_, i) => renderRowSkeleton(`a-${i}`));
    } else if (activities.length === 0) {
        activityContent = (
            <RecoveryState
                icon={<Clock size={24} />}
                title='No login activity'
                description='No recent login attempts found.'
            />
        );
    } else {
        activityContent = activities.map(renderActivity);
    }

    return (
        <SettingsPage title='Session Management'>
            <div className='flex flex-col gap-4 p-6 rounded-xl border border-border'>
                <SettingsSectionHeader
                    title='Active Sessions'
                    description='Devices currently signed in to your account'
                    action={activeSessionsAction}
                />
                {renderList(sessionsContent, !loadingSessions && sessions.length === 0)}
            </div>

            <div className='flex flex-col gap-4 p-6 rounded-xl border border-border'>
                <SettingsSectionHeader
                    title='Login Activity'
                    description='Recent login attempts on your account'
                />
                {renderList(activityContent, !loadingActivity && activities.length === 0)}
            </div>

            <Modal
                id={REVOKE_ALL_MODAL_ID}
                title='Revoke All Other Sessions'
                description='This will sign out all devices except your current session.'
                footer={
                    <ModalFooterActions
                        secondary={{
                            label: 'Cancel',
                            size: 'sm',
                            onPress: closeRevokeAllSessionsModal
                        }}
                        primary={{
                            label: 'Revoke all others',
                            size: 'sm',
                            variant: 'danger',
                            onPress: () => { void revokeAllOtherSessions(); },
                            isPending: isRevoking
                        }}
                    />
                }
            >
                <p className='text-sm text-muted p-6'>
                    Are you sure you want to revoke {otherSessionsCount} other{' '}
                    {otherSessionsCount === 1 ? 'session' : 'sessions'}? This action cannot be undone.
                </p>
            </Modal>
        </SettingsPage>
    );
};

export default SessionSettings;
