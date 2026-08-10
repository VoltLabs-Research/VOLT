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
import { EmptyState, Button, Modal, Skeleton } from '@voltstack/bravais';
import SettingsSectionHeader from '@/shared/ui/components/SettingsSectionHeader';
import useSessionData from '@/modules/session/hooks/use-session-data';
import useTip from '@/shared/tips/use-tip';
import { Clock, Monitor, Shield, Smartphone } from 'lucide-react';
import { SessionActivityType } from '@volt/contracts/modules/session/domain';
import type { ActiveSession, LoginActivityEntry } from '@volt/contracts/modules/session/domain';
import type { ReactNode } from 'react';import './SessionSettings.css';

const getActivityIconToneClass = (action: SessionActivityType, success: boolean): string => {
    if (!success) return 'session-row__icon--danger';
    if (action === SessionActivityType.OAuthLogin) return 'session-row__icon--brand';
    if (action === SessionActivityType.PasswordUpdate) return 'session-row__icon--warning';
    if (action === SessionActivityType.Login) return 'session-row__icon--success';
    return 'session-row__icon--muted';
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
            <li key={session._id} className='session-row'>
                <DeviceIcon size={16} className='session-row__icon session-row__icon--muted' />
                <div className='session-row__body'>
                    <span className='session-row__title'>{session.browser} on {session.os}</span>
                    <span className='session-row__line'>{session.ip}</span>
                    <span className={`session-row__line${session.isCurrent ? ' session-row__line--brand' : ''}`}>
                        {session.isCurrent ? 'Current session' : formatSessionRelativeTime(session.lastActivity)}
                    </span>
                </div>
                {!session.isCurrent && (
                    <Button
                        variant='ghost'
                        intent='danger'
                        size='sm'
                        onClick={() => { void revokeSession(session); }}
                        disabled={isRevoking}
                        className='session-row__action'
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
            <li key={activity._id} className='session-row' aria-label={ariaLabel}>
                <ActionIcon size={16} className={`session-row__icon ${toneClass}`} />
                <div className='session-row__body'>
                    <span className='session-row__title'>{browser} on {os}</span>
                    <span className='session-row__line'>{activity.ip}</span>
                    <span className='session-row__line'>
                        {formatSessionRelativeTime(activity.createdAt)}
                    </span>
                </div>
            </li>
        );
    };

    const renderRowSkeleton = (key: string) => (
        <li key={key} className='session-row'>
            <Skeleton variant='rounded' width={16} height={16} />
            <div className='session-row__body'>
                <Skeleton variant='text' width='45%' height={14} />
                <Skeleton variant='text' width='30%' height={12} />
                <Skeleton variant='text' width='25%' height={12} />
            </div>
        </li>
    );

    let activeSessionsAction: ReactNode;
    if (otherSessionsCount > 0) {
        activeSessionsAction = (
            <Button
                variant='ghost'
                intent='danger'
                size='sm'
                onClick={openRevokeAllSessionsModal}
            >
                Revoke all others
            </Button>
        );
    }

    const renderList = (content: ReactNode, isEmptyState: boolean) => (
        <div className={`session-list-viewport${isEmptyState ? ' session-list-viewport--empty' : ''}`}>
            <ul className='session-list'>
                {content}
            </ul>
        </div>
    );

    let sessionsContent: ReactNode;
    if (loadingSessions) {
        sessionsContent = Array.from({ length: 2 }).map((_, i) => renderRowSkeleton(`s-${i}`));
    } else if (sessions.length === 0) {
        sessionsContent = (
            <EmptyState
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
            <EmptyState
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
                    <>
                        <Button
                            variant='ghost'
                            size='sm'
                            onClick={closeRevokeAllSessionsModal}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant='solid'
                            intent='danger'
                            size='sm'
                            onClick={revokeAllOtherSessions}
                            isLoading={isRevoking}
                        >
                            Revoke all others
                        </Button>
                    </>
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
