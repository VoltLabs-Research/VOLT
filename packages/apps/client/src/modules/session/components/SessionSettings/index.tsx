import { REVOKE_ALL_MODAL_ID } from '@/modules/session/contracts/modal-ids';
import { formatSessionRelativeTime, SESSION_ACTION_LABELS } from '@/modules/session/utils/session-display';
import Scrollable from '@/shared/ui/components/Scrollable';
import { parseUserAgent as parseSessionUserAgent } from '@volt/contracts/modules/session/user-agent';
import SettingsPage from '@/shared/ui/components/SettingsPage';
import SettingsSectionHeader from '@/shared/ui/components/SettingsSectionHeader';
import { Button, Chip, Skeleton, cn } from '@heroui/react';
import { Modal } from '@/shared/ui/modal/Modal';
import ModalFooterActions from '@/shared/ui/components/ModalFooterActions';
import RecoveryState from '@/shared/ui/components/RecoveryState';
import useSessionData from './use-session-data';
import useTip from '@/shared/tips/use-tip';
import { Clock, Shield } from 'lucide-react';
import type { ActiveSession, LoginActivityEntry } from '@volt/contracts/modules/session/domain';
import type { ReactNode } from 'react';

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

    const renderSession = (session: ActiveSession) => (
        <li key={session._id} className='flex items-center gap-3 py-3.5'>
            <div className='flex min-w-0 flex-1 flex-col gap-0.5'>
                <div className='flex min-w-0 items-center gap-2'>
                    <span className='truncate text-base font-medium text-foreground'>{session.browser} on {session.os}</span>
                    {session.isCurrent && (
                        <Chip color='success' variant='soft' size='sm'>
                            <Chip.Label>Current</Chip.Label>
                        </Chip>
                    )}
                </div>
                <span className='truncate text-sm text-muted tabular-nums'>
                    {session.ip} · {session.isCurrent ? 'Active now' : formatSessionRelativeTime(session.lastActivity)}
                </span>
            </div>
            {!session.isCurrent && (
                <Button
                    variant='ghost'
                    size='sm'
                    onPress={() => { void revokeSession(session); }}
                    isDisabled={isRevoking}
                    className='shrink-0'
                >
                    Revoke
                </Button>
            )}
        </li>
    );

    const renderActivity = (activity: LoginActivityEntry) => {
        const { browser, os } = parseSessionUserAgent(activity.userAgent);
        const actionLabel = activity.success
            ? SESSION_ACTION_LABELS[activity.action]
            : 'Failed sign-in';
        const relativeTime = formatSessionRelativeTime(activity.createdAt);
        const ariaLabel = `${actionLabel} · ${browser} on ${os} · ${activity.ip} · ${relativeTime}`;

        return (
            <li key={activity._id} className='flex items-center gap-3 py-3.5' aria-label={ariaLabel}>
                <div className='flex min-w-0 flex-1 flex-col gap-0.5'>
                    <span className={cn('truncate text-base font-medium', activity.success ? 'text-foreground' : 'text-danger-soft-foreground')}>{actionLabel}</span>
                    <span className='truncate text-sm text-muted tabular-nums'>
                        {browser} on {os} · {activity.ip}
                    </span>
                </div>
                <span className='shrink-0 text-sm text-muted tabular-nums'>{relativeTime}</span>
            </li>
        );
    };

    const renderRowSkeleton = (key: string) => (
        <li key={key} className='flex flex-col gap-2 py-4'>
            <Skeleton animationType='pulse' className='h-3.5 w-2/5 rounded-md' />
            <Skeleton animationType='pulse' className='h-3 w-1/3 rounded-md' />
        </li>
    );

    // A list of rows in one tile, or a lone empty state centred in it.
    const renderList = (rows: ReactNode[], emptyState: ReactNode | null) => (
        <div className='rounded-2xl bg-foreground/4 px-5 py-1'>
            {emptyState ?? (
                <Scrollable className='max-h-[26rem]'>
                    <ul className='m-0 flex list-none flex-col divide-y divide-separator p-0'>
                        {rows}
                    </ul>
                </Scrollable>
            )}
        </div>
    );

    let activeSessionsAction: ReactNode;
    if (otherSessionsCount > 0) {
        activeSessionsAction = (
            <Button
                variant='secondary'
                size='sm'
                onPress={openRevokeAllSessionsModal}
            >
                Revoke all others
            </Button>
        );
    }

    let sessionRows: ReactNode[] = sessions.map(renderSession);
    if (loadingSessions) {
        sessionRows = Array.from({ length: 2 }).map((_, i) => renderRowSkeleton(`s-${i}`));
    }

    let activityRows: ReactNode[] = activities.map(renderActivity);
    if (loadingActivity) {
        activityRows = Array.from({ length: 3 }).map((_, i) => renderRowSkeleton(`a-${i}`));
    }

    const sessionsEmptyState = !loadingSessions && sessions.length === 0 ? (
        <RecoveryState
            className='py-8'
            icon={<Shield size={24} />}
            title='No active sessions'
            description='There are no active sessions for your account.'
        />
    ) : null;

    const activityEmptyState = !loadingActivity && activities.length === 0 ? (
        <RecoveryState
            className='py-8'
            icon={<Clock size={24} />}
            title='No login activity'
            description='No recent login attempts found.'
        />
    ) : null;

    return (
        <SettingsPage title='Session Management'>
            <section className='flex flex-col gap-3'>
                <SettingsSectionHeader
                    title='Active Sessions'
                    description='Devices currently signed in to your account'
                    action={activeSessionsAction} />
                {renderList(sessionRows, sessionsEmptyState)}
            </section>
            <section className='flex flex-col gap-3'>
                <SettingsSectionHeader
                    title='Login Activity'
                    description='Recent login attempts on your account' />
                {renderList(activityRows, activityEmptyState)}
            </section>
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
                <p className='text-sm text-muted'>
                    Are you sure you want to revoke {otherSessionsCount} other{' '}
                    {otherSessionsCount === 1 ? 'session' : 'sessions'}? This action cannot be undone.
                </p>
            </Modal>
        </SettingsPage>
    );
};

export default SessionSettings;
