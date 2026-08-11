import {
    REVOKE_ALL_MODAL_ID
} from '@/modules/session/hooks/use-session-data';
import { formatSessionRelativeTime, getSessionActivityIcon, SESSION_ACTION_LABELS } from '@/modules/session/utils/session-display';
import { parseUserAgent as parseSessionUserAgent } from '@volt/contracts/modules/session/user-agent';
import SettingsPage from '@/shared/ui/components/SettingsPage';
import { Avatar, Button, Card, Chip, Separator, Skeleton } from '@heroui/react';
import { Modal } from '@/shared/ui/modal/Modal';
import ModalFooterActions from '@/shared/ui/components/ModalFooterActions';
import RecoveryState from '@/shared/ui/components/RecoveryState';
import useSessionData from '@/modules/session/hooks/use-session-data';
import useTip from '@/shared/tips/use-tip';
import { Clock, Monitor, Shield, Smartphone } from 'lucide-react';
import { Fragment } from 'react';
import { SessionActivityType } from '@volt/contracts/modules/session/domain';
import type { ActiveSession, LoginActivityEntry } from '@volt/contracts/modules/session/domain';
import type { ComponentProps, ReactNode } from 'react';

type AvatarColor = NonNullable<ComponentProps<typeof Avatar.Fallback>['color']>;

const getActivityAvatarColor = (activity: LoginActivityEntry): AvatarColor => {
    if(!activity.success) return 'danger';
    if(activity.action === SessionActivityType.OAuthLogin) return 'accent';
    if(activity.action === SessionActivityType.PasswordUpdate) return 'warning';
    if(activity.action === SessionActivityType.Login) return 'success';
    return 'default';
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
            <li key={session._id} className='flex items-center gap-3 py-3'>
                <Avatar variant='soft'>
                    <Avatar.Fallback color={session.isCurrent ? 'success' : 'default'}>
                        <DeviceIcon size={16} aria-hidden='true' />
                    </Avatar.Fallback>
                </Avatar>
                <div className='flex min-w-0 flex-1 flex-col gap-0.5'>
                    <div className='flex min-w-0 items-center gap-2'>
                        <span className='truncate text-sm font-medium text-foreground'>{session.browser} on {session.os}</span>
                        {session.isCurrent && (
                            <Chip color='success' variant='soft' size='sm'>
                                <Chip.Label>Current</Chip.Label>
                            </Chip>
                        )}
                    </div>
                    <span className='truncate text-xs text-muted tabular-nums'>
                        {session.ip} · {session.isCurrent ? 'Active now' : formatSessionRelativeTime(session.lastActivity)}
                    </span>
                </div>
                {!session.isCurrent && (
                    <Button
                        variant='danger-soft'
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
    };

    const renderActivity = (activity: LoginActivityEntry) => {
        const { browser, os } = parseSessionUserAgent(activity.userAgent);
        const ActionIcon = getSessionActivityIcon(activity.action);
        const actionLabel = activity.success
            ? SESSION_ACTION_LABELS[activity.action]
            : 'Failed sign-in';
        const ariaLabel = `${actionLabel} · ${browser} on ${os} · ${activity.ip}`;

        return (
            <li key={activity._id} className='flex items-center gap-3 py-3' aria-label={ariaLabel}>
                <Avatar variant='soft'>
                    <Avatar.Fallback color={getActivityAvatarColor(activity)}>
                        <ActionIcon size={16} aria-hidden='true' />
                    </Avatar.Fallback>
                </Avatar>
                <div className='flex min-w-0 flex-1 flex-col gap-0.5'>
                    <span className='truncate text-sm font-medium text-foreground'>{actionLabel}</span>
                    <span className='truncate text-xs text-muted tabular-nums'>
                        {browser} on {os} · {activity.ip} · {formatSessionRelativeTime(activity.createdAt)}
                    </span>
                </div>
                {!activity.success && (
                    <Chip color='danger' variant='soft' size='sm' className='shrink-0'>
                        <Chip.Label>Failed</Chip.Label>
                    </Chip>
                )}
            </li>
        );
    };

    const renderRowSkeleton = (key: string) => (
        <li key={key} className='flex items-center gap-3 py-3'>
            <Skeleton animationType='pulse' className='size-10 rounded-xl' />
            <div className='flex min-w-0 flex-1 flex-col gap-1.5'>
                <Skeleton animationType='pulse' className='rounded-md origin-[0_55%] scale-y-60 h-[14px] w-[45%]' />
                <Skeleton animationType='pulse' className='rounded-md origin-[0_55%] scale-y-60 h-[12px] w-[30%]' />
            </div>
        </li>
    );

    const renderList = (rows: ReactNode[], isEmptyState: boolean) => (
        <div className={isEmptyState ? '' : 'max-h-[26rem] overflow-y-auto'}>
            <ul className='m-0 p-0 list-none flex flex-col'>
                {rows.map((row, index) => (
                    <Fragment key={index}>
                        {index > 0 && <Separator />}
                        {row}
                    </Fragment>
                ))}
            </ul>
        </div>
    );

    let activeSessionsAction: ReactNode;
    if (otherSessionsCount > 0) {
        activeSessionsAction = (
            <Button
                variant='danger-soft'
                size='sm'
                className='shrink-0'
                onPress={openRevokeAllSessionsModal}
            >
                Revoke all others
            </Button>
        );
    }

    let sessionRows: ReactNode[];
    if (loadingSessions) {
        sessionRows = Array.from({ length: 2 }).map((_, i) => renderRowSkeleton(`s-${i}`));
    } else if (sessions.length === 0) {
        sessionRows = [
            <RecoveryState
                icon={<Shield size={24} />}
                title='No active sessions'
                description='There are no active sessions for your account.'
            />
        ];
    } else {
        sessionRows = sessions.map(renderSession);
    }

    let activityRows: ReactNode[];
    if (loadingActivity) {
        activityRows = Array.from({ length: 3 }).map((_, i) => renderRowSkeleton(`a-${i}`));
    } else if (activities.length === 0) {
        activityRows = [
            <RecoveryState
                icon={<Clock size={24} />}
                title='No login activity'
                description='No recent login attempts found.'
            />
        ];
    } else {
        activityRows = activities.map(renderActivity);
    }

    return (
        <SettingsPage title='Session Management'>
            <Card>
                <Card.Header>
                    <div className='flex w-full items-center justify-between gap-4 max-sm:flex-col max-sm:items-start'>
                        <div className='flex flex-col gap-1'>
                            <Card.Title>Active Sessions</Card.Title>
                            <Card.Description>Devices currently signed in to your account</Card.Description>
                        </div>
                        {activeSessionsAction}
                    </div>
                </Card.Header>
                <Card.Content>
                    {renderList(sessionRows, !loadingSessions && sessions.length === 0)}
                </Card.Content>
            </Card>
            <Card>
                <Card.Header>
                    <div className='flex flex-col gap-1'>
                        <Card.Title>Login Activity</Card.Title>
                        <Card.Description>Recent login attempts on your account</Card.Description>
                    </div>
                </Card.Header>
                <Card.Content>
                    {renderList(activityRows, !loadingActivity && activities.length === 0)}
                </Card.Content>
            </Card>
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
