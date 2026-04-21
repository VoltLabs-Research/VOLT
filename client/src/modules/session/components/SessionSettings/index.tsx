import {
    REVOKE_ALL_MODAL_ID,
    REVOKE_MODAL_ID
} from '@/modules/session/hooks/use-session-data';
import {
    formatSessionRelativeTime,
    getSessionActivityIcon,
    getSessionTokenInfo,
    isMobileUserAgent,
    parseSessionUserAgent,
    SESSION_ACTION_LABELS,
    SESSION_ACTION_VARIANTS
} from '@/modules/session/utilities';
import SettingsPage from '@/shared/presentation/components/SettingsPage';
import SettingsSection from '@/shared/presentation/components/SettingsSection';
import SettingsSectionHeader from '@/shared/presentation/components/SettingsSectionHeader';
import useSessionData from '@/modules/session/hooks/use-session-data';
import useTip from '@/shared/tips/use-tip';
import Button from '@/shared/presentation/components/Button';
import EmptyState from '@/shared/presentation/components/EmptyState';
import Modal from '@/shared/presentation/components/Modal';
import StatusBadge from '@/shared/presentation/components/StatusBadge';
import { Globe, Monitor, Shield, Smartphone } from 'lucide-react';
import Skeleton from '@/shared/presentation/components/Skeleton';
import type { ActiveSession, LoginActivityEntry } from '@/modules/session/api/entities/session';
import type { FC, ReactNode } from 'react';
import './SessionSettings.css';

interface SessionRowMeta {
    browser: string;
    os: string;
    tokenInfo: string;
};

const getSessionRowMeta = (session: ActiveSession): SessionRowMeta => {
    const { browser, os } = parseSessionUserAgent(session.userAgent);

    return {
        browser,
        os,
        tokenInfo: getSessionTokenInfo(session.token).shortValue
    };
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
        const meta = getSessionRowMeta(session);
        const DeviceIcon = isMobileUserAgent(session.userAgent) ? Smartphone : Monitor;

        return (
            <li
                key={session._id}
                className={`session-card d-flex items-center gap-1 p-075 ${isCurrent ? 'current-session' : ''}`}
            >
                <div className="volt-container d-flex items-center content-center f-shrink-0 color-muted">
                    <DeviceIcon size={20} />
                </div>

                <div className="volt-container session-card-main flex-1 d-flex column gap-025">
                    <div className="volt-container session-card-title-row d-flex items-center gap-05 flex-wrap">
                        <p className="volt-text font-weight-5 font-size-2">
                            {meta.browser} on {meta.os}
                        </p>
                        {isCurrent && (
                            <StatusBadge variant="brand" size="compact">Current</StatusBadge>
                        )}
                    </div>
                    <div className="volt-container session-card-meta-row d-flex items-center gap-05 flex-wrap">
                        <p className="volt-text session-ip color-muted">
                            {session.ip}
                        </p>
                        <p className='volt-text session-token color-muted font-size-1'>
                            Token {meta.tokenInfo}
                        </p>
                        <p className="volt-text color-muted font-size-1">
                            · {formatSessionRelativeTime(session.lastActivity)}
                        </p>
                    </div>
                </div>

                <div className="volt-container session-card-actions d-flex items-center gap-05 f-shrink-0">
                    <StatusBadge
                        variant={SESSION_ACTION_VARIANTS[session.action]}
                        size="compact"
                    >
                        {SESSION_ACTION_LABELS[session.action]}
                    </StatusBadge>
                    {!isCurrent && (
                        <Button
                            variant="ghost"
                            intent="danger"
                            size="sm"
                            onClick={() => openRevokeSessionModal(session)}
                        >
                            Revoke
                        </Button>
                    )}
                </div>
            </li>
        );
    };

    const renderActivity = (activity: LoginActivityEntry, index: number) => {
        const { browser, os } = parseSessionUserAgent(activity.userAgent);
        const ActionIcon = getSessionActivityIcon(activity.action);

        return (
            <li
                key={`${activity._id}-${index}`}
                className="session-activity-row d-flex items-center gap-075 p-05 radius-md"
            >
                <div className="volt-container d-flex items-center content-center f-shrink-0 color-muted">
                    <ActionIcon size={16} />
                </div>

                <div className="volt-container session-card-main flex-1 d-flex column gap-025">
                    <p className="volt-text font-weight-5 font-size-2">
                        {SESSION_ACTION_LABELS[activity.action]} · {browser} on {os}
                    </p>
                    <div className="volt-container session-card-meta-row d-flex items-center gap-05 flex-wrap">
                        <p className="volt-text session-ip color-muted">
                            {activity.ip}
                        </p>
                        <p className="volt-text color-muted font-size-1">
                            · {formatSessionRelativeTime(activity.createdAt)}
                        </p>
                    </div>
                </div>

                <div className="volt-container d-flex items-center gap-05 f-shrink-0">
                    <div className={`volt-container activity-dot ${activity.success ? 'success' : 'failed'}`} />
                    <StatusBadge
                        variant={activity.success ? 'success' : 'danger'}
                        size="compact"
                    >
                        {activity.success ? 'Success' : 'Failed'}
                    </StatusBadge>
                </div>
            </li>
        );
    };

    let activeSessionsAction: ReactNode;
    if (otherSessionsCount > 0) {
        activeSessionsAction = (
            <Button
                variant="soft"
                intent="danger"
                size="sm"
                onClick={openRevokeAllSessionsModal}
            >
                Revoke All Others
            </Button>
        );
    }

    let sessionsContent: ReactNode;
    if (loadingSessions) {
        sessionsContent = Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="volt-container d-flex items-center gap-1 p-075">
                <Skeleton variant="circular" width={36} height={36} />
                <div className="volt-container flex-1 d-flex column gap-025">
                    <Skeleton variant="text" width="40%" height={20} />
                    <Skeleton variant="text" width="25%" height={16} />
                </div>
                <Skeleton variant="rounded" width={60} height={28} />
            </div>
        ));
    } else if (sessions.length === 0) {
        sessionsContent = (
            <EmptyState
                icon={<Shield size={32} />}
                title="No active sessions"
                description="There are no active sessions for your account."
            />
        );
    } else {
        sessionsContent = sessions.map(renderSession);
    }

    let activityContent: ReactNode;
    if (loadingActivity) {
        activityContent = Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="volt-container d-flex items-center gap-1 p-05">
                <Skeleton variant="circular" width={6} height={6} />
                <div className="volt-container flex-1 d-flex column gap-025">
                    <Skeleton variant="text" width="35%" height={18} />
                    <Skeleton variant="text" width="20%" height={14} />
                </div>
                <Skeleton variant="rounded" width={50} height={22} />
            </div>
        ));
    } else if (activities.length === 0) {
        activityContent = (
            <EmptyState
                icon={<Globe size={32} />}
                title="No login activity"
                description="No recent login attempts found."
            />
        );
    } else {
        activityContent = activities.map(renderActivity);
    }

    return (
        <SettingsPage title="Session Management">
            <SettingsSection>
                <SettingsSectionHeader
                    title="Active Sessions"
                    description="Devices currently signed in to your account"
                    action={activeSessionsAction}
                />

                <ul className='session-list d-flex column gap-075'>
                    {sessionsContent}
                </ul>
            </SettingsSection>

            <SettingsSection>
                <SettingsSectionHeader
                    title="Login Activity"
                    description="Recent login attempts on your account"
                    action={undefined}
                />

                <ul className='session-list d-flex column gap-075'>
                    {activityContent}
                </ul>
            </SettingsSection>

            <Modal
                id={REVOKE_MODAL_ID}
                title="Revoke Session"
                description="This will sign out the device associated with this session."
                footer={
                    <>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={closeRevokeSessionModal}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="solid"
                            intent="danger"
                            size="sm"
                            onClick={revokeSession}
                            isLoading={isRevoking}
                        >
                            Revoke Session
                        </Button>
                    </>
                }
            >
                {revokeTarget && (
                    <p className="volt-text font-size-2 color-muted p-1-5">
                        Are you sure you want to revoke the session from{' '}
                        <strong>{parseSessionUserAgent(revokeTarget.userAgent).browser}</strong> on{' '}
                        <strong>{parseSessionUserAgent(revokeTarget.userAgent).os}</strong> ({revokeTarget.ip})?
                    </p>
                )}
            </Modal>

            <Modal
                id={REVOKE_ALL_MODAL_ID}
                title="Revoke All Other Sessions"
                description="This will sign out all devices except your current session."
                footer={
                    <>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={closeRevokeAllSessionsModal}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="solid"
                            intent="danger"
                            size="sm"
                            onClick={revokeAllOtherSessions}
                            isLoading={isRevoking}
                        >
                            Revoke All Others
                        </Button>
                    </>
                }
            >
                <p className="volt-text font-size-2 p-1-5 color-muted">
                    Are you sure you want to revoke {otherSessionsCount} other{' '}
                    {otherSessionsCount === 1 ? 'session' : 'sessions'}? This action cannot be undone.
                </p>
            </Modal>
        </SettingsPage>
    );
};

export default SessionSettings;
