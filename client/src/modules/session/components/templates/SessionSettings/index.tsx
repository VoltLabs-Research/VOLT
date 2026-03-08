import {
    REVOKE_ALL_MODAL_ID,
    REVOKE_MODAL_ID
} from '@/modules/session/hooks/use-session-data';
import {
    formatSessionRelativeTime,
    getSessionActivityIcon,
    isMobileUserAgent,
    parseSessionUserAgent,
    SESSION_ACTION_LABELS,
    SESSION_ACTION_VARIANTS
} from '@/modules/session/utilities';
import SettingsSection from '@/modules/session/components/atoms/SettingsSection';
import SettingsSectionHeader from '@/modules/session/components/molecules/SettingsSectionHeader';
import SettingsPage from '@/shared/presentation/components/SettingsPage';
import useSessionData from '@/modules/session/hooks/use-session-data';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import EmptyState from '@/shared/presentation/components/EmptyState';
import Modal from '@/shared/presentation/components/Modal';
import Paragraph from '@/shared/presentation/components/Paragraph';
import StatusBadge from '@/shared/presentation/components/StatusBadge';
import { Globe, Monitor, Shield, Smartphone } from 'lucide-react';
import Skeleton from '@mui/material/Skeleton';
import type { ActiveSession, LoginActivityEntry } from '@/modules/session/api/entities/session';
import type { FC, ReactNode } from 'react';
import './SessionSettings.css';

const SessionSettings: FC = () => {
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
            <Container
                key={session._id}
                className={`session-card d-flex items-center gap-1 p-075 ${isCurrent ? 'current-session' : ''}`}
            >
                <Container className="d-flex items-center content-center f-shrink-0 color-muted">
                    <DeviceIcon size={20} />
                </Container>

                <Container className="flex-1 d-flex column gap-025">
                    <Container className="d-flex items-center gap-05">
                        <Paragraph className="font-weight-5 font-size-2">
                            {browser} on {os}
                        </Paragraph>
                        {isCurrent && (
                            <StatusBadge variant="brand" size="compact">Current</StatusBadge>
                        )}
                    </Container>
                    <Container className="d-flex items-center gap-05">
                        <Paragraph className="session-ip color-muted">
                            {session.ip}
                        </Paragraph>
                        <Paragraph className="color-muted font-size-1">
                            · {formatSessionRelativeTime(session.lastActivity)}
                        </Paragraph>
                    </Container>
                </Container>

                <Container className="d-flex items-center gap-05 f-shrink-0">
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
                </Container>
            </Container>
        );
    };

    const renderActivity = (activity: LoginActivityEntry, index: number) => {
        const { browser, os } = parseSessionUserAgent(activity.userAgent);
        const ActionIcon = getSessionActivityIcon(activity.action);

        return (
            <Container
                key={`${activity._id}-${index}`}
                className="d-flex items-center gap-075 p-05 radius-md"
            >
                <Container className="d-flex items-center content-center f-shrink-0 color-muted">
                    <ActionIcon size={16} />
                </Container>

                <Container className="flex-1 d-flex column gap-025">
                    <Paragraph className="font-weight-5 font-size-2">
                        {SESSION_ACTION_LABELS[activity.action]} · {browser} on {os}
                    </Paragraph>
                    <Container className="d-flex items-center gap-05">
                        <Paragraph className="session-ip color-muted">
                            {activity.ip}
                        </Paragraph>
                        <Paragraph className="color-muted font-size-1">
                            · {formatSessionRelativeTime(activity.createdAt)}
                        </Paragraph>
                    </Container>
                </Container>

                <Container className="d-flex items-center gap-05 f-shrink-0">
                    <Container
                        className={`activity-dot ${activity.success ? 'success' : 'failed'}`}
                    />
                    <StatusBadge
                        variant={activity.success ? 'success' : 'danger'}
                        size="compact"
                    >
                        {activity.success ? 'Success' : 'Failed'}
                    </StatusBadge>
                </Container>
            </Container>
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
            <Container key={i} className="d-flex items-center gap-1 p-075">
                <Skeleton variant="circular" width={36} height={36} />
                <Container className="flex-1 d-flex column gap-025">
                    <Skeleton variant="text" width="40%" height={20} />
                    <Skeleton variant="text" width="25%" height={16} />
                </Container>
                <Skeleton variant="rounded" width={60} height={28} />
            </Container>
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
            <Container key={i} className="d-flex items-center gap-1 p-05">
                <Skeleton variant="circular" width={6} height={6} />
                <Container className="flex-1 d-flex column gap-025">
                    <Skeleton variant="text" width="35%" height={18} />
                    <Skeleton variant="text" width="20%" height={14} />
                </Container>
                <Skeleton variant="rounded" width={50} height={22} />
            </Container>
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

                <Container className="d-flex column gap-075">
                    {sessionsContent}
                </Container>
            </SettingsSection>

            <SettingsSection>
                <SettingsSectionHeader
                    title="Login Activity"
                    description="Recent login attempts on your account"
                    action={undefined}
                />

                <Container className="d-flex column gap-075">
                    {activityContent}
                </Container>
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
                    <Paragraph className="font-size-2 color-muted">
                        Are you sure you want to revoke the session from{' '}
                        <strong>{parseSessionUserAgent(revokeTarget.userAgent).browser}</strong> on{' '}
                        <strong>{parseSessionUserAgent(revokeTarget.userAgent).os}</strong> ({revokeTarget.ip})?
                    </Paragraph>
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
                <Paragraph className="font-size-2 color-muted">
                    Are you sure you want to revoke {otherSessionsCount} other{' '}
                    {otherSessionsCount === 1 ? 'session' : 'sessions'}? This action cannot be undone.
                </Paragraph>
            </Modal>
        </SettingsPage>
    );
};

export default SessionSettings;
