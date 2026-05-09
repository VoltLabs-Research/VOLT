import {
    REVOKE_ALL_MODAL_ID,
    REVOKE_MODAL_ID
} from '@/modules/session/hooks/use-session-data';
import {
    formatSessionRelativeTime,
    getSessionActivityIcon,
    isMobileUserAgent,
    parseSessionUserAgent,
    SESSION_ACTION_LABELS
} from '@/modules/session/utilities/session-display';
import SettingsPage from '@/shared/presentation/components/SettingsPage';
import SettingsSection from '@/shared/presentation/components/SettingsSection';
import SettingsSectionHeader from '@/shared/presentation/components/SettingsSectionHeader';
import useSessionData from '@/modules/session/hooks/use-session-data';
import useTip from '@/shared/tips/use-tip';
import EmptyState from '@/shared/presentation/primitives/EmptyState';
import Button from '@/shared/presentation/primitives/Button';
import Modal from '@/shared/presentation/primitives/Modal';
import Skeleton from '@/shared/presentation/primitives/Skeleton';
import Text from '@/shared/presentation/primitives/Text';
import { Clock, Monitor, Shield, Smartphone } from 'lucide-react';
import { SessionActivityType } from '@/modules/session/api/entities/session';
import type { ActiveSession, LoginActivityEntry } from '@/modules/session/api/entities/session';
import type { FC, ReactNode } from 'react';
import './SessionSettings.css';

const getActivityIconToneClass = (action: SessionActivityType, success: boolean): string => {
    if (!success) return 'session-row__icon--danger';
    if (action === SessionActivityType.OAuthLogin) return 'session-row__icon--brand';
    if (action === SessionActivityType.PasswordUpdate) return 'session-row__icon--warning';
    if (action === SessionActivityType.Login) return 'session-row__icon--success';
    return 'session-row__icon--muted';
};

const SessionSettings: FC = () => {
    useTip('session-management');

    const {
        activities,
        closeRevokeAllSessionsModal,
        closeRevokeSessionModal,
        isCurrentSession,
        isRevoking,
        loadingActivity,
        loadingSessions,
        openRevokeAllSessionsModal,
        openRevokeSessionModal,
        otherSessionsCount,
        revokeAllOtherSessions,
        revokeSession,
        revokeTarget,
        sessions
    } = useSessionData();

    const renderSession = (session: ActiveSession) => {
        const isCurrent = isCurrentSession(session);
        const { browser, os } = parseSessionUserAgent(session.userAgent);
        const DeviceIcon = isMobileUserAgent(session.userAgent) ? Smartphone : Monitor;

        return (
            <li key={session._id} className='session-row'>
                <DeviceIcon size={16} className='session-row__icon session-row__icon--muted' />
                <div className='session-row__body'>
                    <span className='session-row__title'>{browser} on {os}</span>
                    <span className='session-row__line'>{session.ip}</span>
                    <span className={`session-row__line${isCurrent ? ' session-row__line--brand' : ''}`}>
                        {isCurrent ? 'Current session' : formatSessionRelativeTime(session.lastActivity)}
                    </span>
                </div>
                {!isCurrent && (
                    <Button
                        variant='ghost'
                        intent='danger'
                        size='sm'
                        onClick={() => openRevokeSessionModal(session)}
                        className='session-row__action'
                    >
                        Revoke
                    </Button>
                )}
            </li>
        );
    };

    const renderActivity = (activity: LoginActivityEntry, index: number) => {
        const { browser, os } = parseSessionUserAgent(activity.userAgent);
        const ActionIcon = getSessionActivityIcon(activity.action);
        const toneClass = getActivityIconToneClass(activity.action, activity.success);
        const actionLabel = activity.success
            ? SESSION_ACTION_LABELS[activity.action]
            : 'Failed sign-in';
        const ariaLabel = `${actionLabel} · ${browser} on ${os} · ${activity.ip}`;

        return (
            <li key={`${activity._id}-${index}`} className='session-row' aria-label={ariaLabel}>
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
    let sessionsEmpty = false;
    if (loadingSessions) {
        sessionsContent = Array.from({ length: 2 }).map((_, i) => renderRowSkeleton(`s-${i}`));
    } else if (sessions.length === 0) {
        sessionsEmpty = true;
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
    let activityEmpty = false;
    if (loadingActivity) {
        activityContent = Array.from({ length: 3 }).map((_, i) => renderRowSkeleton(`a-${i}`));
    } else if (activities.length === 0) {
        activityEmpty = true;
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
            <SettingsSection>
                <SettingsSectionHeader
                    title='Active Sessions'
                    description='Devices currently signed in to your account'
                    action={activeSessionsAction}
                />
                {renderList(sessionsContent, sessionsEmpty)}
            </SettingsSection>

            <SettingsSection>
                <SettingsSectionHeader
                    title='Login Activity'
                    description='Recent login attempts on your account'
                />
                {renderList(activityContent, activityEmpty)}
            </SettingsSection>

            <Modal
                id={REVOKE_MODAL_ID}
                title='Revoke Session'
                description='This will sign out the device associated with this session.'
                footer={
                    <>
                        <Button
                            variant='ghost'
                            size='sm'
                            onClick={closeRevokeSessionModal}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant='solid'
                            intent='danger'
                            size='sm'
                            onClick={revokeSession}
                            isLoading={isRevoking}
                        >
                            Revoke session
                        </Button>
                    </>
                }
            >
                {revokeTarget && (
                    <Text as='p' size='md' tone='muted' className='p-1-5'>
                        Are you sure you want to revoke the session from{' '}
                        <strong>{parseSessionUserAgent(revokeTarget.userAgent).browser}</strong> on{' '}
                        <strong>{parseSessionUserAgent(revokeTarget.userAgent).os}</strong> ({revokeTarget.ip})?
                    </Text>
                )}
            </Modal>

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
                <Text as='p' size='md' tone='muted' className='p-1-5'>
                    Are you sure you want to revoke {otherSessionsCount} other{' '}
                    {otherSessionsCount === 1 ? 'session' : 'sessions'}? This action cannot be undone.
                </Text>
            </Modal>
        </SettingsPage>
    );
};

export default SessionSettings;
