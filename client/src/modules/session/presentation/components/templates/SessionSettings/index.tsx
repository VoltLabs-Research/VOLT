import React, { useState, useEffect, useCallback } from 'react';
import { Monitor, Smartphone, Globe, Shield, LogIn, KeyRound } from 'lucide-react';
import Skeleton from '@mui/material/Skeleton';
import Container from '@/shared/presentation/components/Container';
import Button from '@/shared/presentation/components/Button';
import StatusBadge from '@/shared/presentation/components/StatusBadge';
import EmptyState from '@/shared/presentation/components/EmptyState';
import Modal, { openModal, closeModal } from '@/shared/presentation/components/Modal';
import Paragraph from '@/shared/presentation/components/Paragraph';
import SettingsPage from '@/modules/auth/presentation/components/templates/Settings/SettingsPage';
import SettingsSection from '@/modules/auth/presentation/components/atoms/SettingsSection';
import SettingsSectionHeader from '@/modules/auth/presentation/components/molecules/SettingsSectionHeader';
import useSessionUseCases from '@/modules/session/presentation/hooks/use-session-use-cases';
import { showPromise } from '@/shared/presentation/hooks/toast';
import { sileo } from 'sileo';
import { Session, SessionActivityType } from '@/modules/session/domain/entities/Session';
import './SessionSettings.css';

const REVOKE_MODAL_ID = 'revoke-session-modal';
const REVOKE_ALL_MODAL_ID = 'revoke-all-sessions-modal';

const parseUserAgent = (ua: string): { browser: string; os: string } => {
    let browser = 'Unknown Browser';
    let os = 'Unknown OS';

    if (ua.includes('Firefox/')) browser = 'Firefox';
    else if (ua.includes('Edg/')) browser = 'Edge';
    else if (ua.includes('OPR/') || ua.includes('Opera/')) browser = 'Opera';
    else if (ua.includes('Chrome/') && ua.includes('Safari/')) browser = 'Chrome';
    else if (ua.includes('Safari/') && !ua.includes('Chrome/')) browser = 'Safari';

    if (ua.includes('Windows')) os = 'Windows';
    else if (ua.includes('Mac OS X') || ua.includes('Macintosh')) os = 'macOS';
    else if (ua.includes('Android')) os = 'Android';
    else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
    else if (ua.includes('Linux')) os = 'Linux';
    else if (ua.includes('CrOS')) os = 'ChromeOS';

    return { browser, os };
};

const isMobileUA = (ua: string): boolean =>
    /Android|iPhone|iPad|iPod|Mobile/i.test(ua);

const formatRelativeTime = (dateStr: string): string => {
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diffMs = now - then;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);

    if (diffSec < 60) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDay < 30) return `${diffDay}d ago`;
    return new Date(dateStr).toLocaleDateString();
};

const actionLabels: Record<SessionActivityType, string> = {
    [SessionActivityType.Login]: 'Login',
    [SessionActivityType.Logout]: 'Logout',
    [SessionActivityType.FailedLogin]: 'Failed',
    [SessionActivityType.OAuthLogin]: 'OAuth',
    [SessionActivityType.PasswordUpdate]: 'Password Update'
};

const actionVariants: Record<SessionActivityType, 'success' | 'danger' | 'warning' | 'brand' | 'neutral'> = {
    [SessionActivityType.Login]: 'success',
    [SessionActivityType.Logout]: 'neutral',
    [SessionActivityType.FailedLogin]: 'danger',
    [SessionActivityType.OAuthLogin]: 'brand',
    [SessionActivityType.PasswordUpdate]: 'warning'
};

const SessionSettings: React.FC = () => {
    const { sessionRepository } = useSessionUseCases();
    const [sessions, setSessions] = useState<Session[]>([]);
    const [activities, setActivities] = useState<Session[]>([]);
    const [loadingSessions, setLoadingSessions] = useState(true);
    const [loadingActivity, setLoadingActivity] = useState(true);
    const [revokeTarget, setRevokeTarget] = useState<Session | null>(null);
    const [isRevoking, setIsRevoking] = useState(false);

    const currentToken = localStorage.getItem('authToken');

    const loadSessions = useCallback(async () => {
        try {
            setLoadingSessions(true);
            const data = await sessionRepository.getActiveSessions();
            setSessions(data);
        } catch {
            sileo.error({ title: 'Failed to load sessions' });
        } finally {
            setLoadingSessions(false);
        }
    }, [sessionRepository]);

    const loadActivity = useCallback(async () => {
        try {
            setLoadingActivity(true);
            const data = await sessionRepository.getLoginActivity(20);
            setActivities(data.activites);
        } catch {
            sileo.error({ title: 'Failed to load login activity' });
        } finally {
            setLoadingActivity(false);
        }
    }, [sessionRepository]);

    useEffect(() => {
        loadSessions();
        loadActivity();
    }, [loadSessions, loadActivity]);

    const handleRevokeSession = async () => {
        if (!revokeTarget?._id) return;
        setIsRevoking(true);
        try {
            await showPromise(
                sessionRepository.revokeSession(revokeTarget._id),
                {
                    loading: { title: 'Revoking session...' },
                    success: { title: 'Session revoked' },
                    error: { title: 'Failed to revoke session' }
                }
            );
            closeModal(REVOKE_MODAL_ID);
            setRevokeTarget(null);
            await loadSessions();
        } finally {
            setIsRevoking(false);
        }
    };

    const handleRevokeAll = async () => {
        setIsRevoking(true);
        try {
            await showPromise(
                sessionRepository.revokeAllOtherSessions(),
                {
                    loading: { title: 'Revoking all other sessions...' },
                    success: { title: 'All other sessions revoked' },
                    error: { title: 'Failed to revoke sessions' }
                }
            );
            closeModal(REVOKE_ALL_MODAL_ID);
            await loadSessions();
        } finally {
            setIsRevoking(false);
        }
    };

    const openRevokeModal = (session: Session) => {
        setRevokeTarget(session);
        openModal(REVOKE_MODAL_ID);
    };

    const otherSessionsCount = sessions.filter(s => s.token !== currentToken).length;

    return (
        <SettingsPage title="Session Management">
            <SettingsSection>
                <SettingsSectionHeader
                    title="Active Sessions"
                    description="Devices currently signed in to your account"
                    action={
                        otherSessionsCount > 0 ? (
                            <Button
                                variant="soft"
                                intent="danger"
                                size="sm"
                                onClick={() => openModal(REVOKE_ALL_MODAL_ID)}
                            >
                                Revoke All Others
                            </Button>
                        ) : undefined
                    }
                />

                <Container className="d-flex column gap-075">
                    {loadingSessions ? (
                        Array.from({ length: 3 }).map((_, i) => (
                            <Container key={i} className="d-flex items-center gap-1 p-075">
                                <Skeleton variant="circular" width={36} height={36} />
                                <Container className="flex-1 d-flex column gap-025">
                                    <Skeleton variant="text" width="40%" height={20} />
                                    <Skeleton variant="text" width="25%" height={16} />
                                </Container>
                                <Skeleton variant="rounded" width={60} height={28} />
                            </Container>
                        ))
                    ) : sessions.length === 0 ? (
                        <EmptyState
                            icon={<Shield size={32} />}
                            title="No active sessions"
                            description="There are no active sessions for your account."
                        />
                    ) : (
                        sessions.map((session) => {
                            const isCurrent = session.token === currentToken;
                            const { browser, os } = parseUserAgent(session.userAgent);
                            const DeviceIcon = isMobileUA(session.userAgent) ? Smartphone : Monitor;

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
                                                · {formatRelativeTime(session.lastActivity)}
                                            </Paragraph>
                                        </Container>
                                    </Container>

                                    <Container className="d-flex items-center gap-05 f-shrink-0">
                                        <StatusBadge
                                            variant={actionVariants[session.action]}
                                            size="compact"
                                        >
                                            {actionLabels[session.action]}
                                        </StatusBadge>
                                        {!isCurrent && (
                                            <Button
                                                variant="ghost"
                                                intent="danger"
                                                size="sm"
                                                onClick={() => openRevokeModal(session)}
                                            >
                                                Revoke
                                            </Button>
                                        )}
                                    </Container>
                                </Container>
                            );
                        })
                    )}
                </Container>
            </SettingsSection>

            <SettingsSection>
                <SettingsSectionHeader
                    title="Login Activity"
                    description="Recent login attempts on your account"
                />

                <Container className="d-flex column gap-075">
                    {loadingActivity ? (
                        Array.from({ length: 4 }).map((_, i) => (
                            <Container key={i} className="d-flex items-center gap-1 p-05">
                                <Skeleton variant="circular" width={6} height={6} />
                                <Container className="flex-1 d-flex column gap-025">
                                    <Skeleton variant="text" width="35%" height={18} />
                                    <Skeleton variant="text" width="20%" height={14} />
                                </Container>
                                <Skeleton variant="rounded" width={50} height={22} />
                            </Container>
                        ))
                    ) : activities.length === 0 ? (
                        <EmptyState
                            icon={<Globe size={32} />}
                            title="No login activity"
                            description="No recent login attempts found."
                        />
                    ) : (
                        activities.map((activity, index) => {
                            const { browser, os } = parseUserAgent(activity.userAgent);
                            const ActionIcon = activity.action === SessionActivityType.OAuthLogin
                                ? Globe
                                : activity.action === SessionActivityType.PasswordUpdate
                                    ? KeyRound
                                    : LogIn;

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
                                            {actionLabels[activity.action]} · {browser} on {os}
                                        </Paragraph>
                                        <Container className="d-flex items-center gap-05">
                                            <Paragraph className="session-ip color-muted">
                                                {activity.ip}
                                            </Paragraph>
                                            <Paragraph className="color-muted font-size-1">
                                                · {formatRelativeTime(activity.createdAt)}
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
                        })
                    )}
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
                            onClick={() => closeModal(REVOKE_MODAL_ID)}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="solid"
                            intent="danger"
                            size="sm"
                            onClick={handleRevokeSession}
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
                        <strong>{parseUserAgent(revokeTarget.userAgent).browser}</strong> on{' '}
                        <strong>{parseUserAgent(revokeTarget.userAgent).os}</strong> ({revokeTarget.ip})?
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
                            onClick={() => closeModal(REVOKE_ALL_MODAL_ID)}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="solid"
                            intent="danger"
                            size="sm"
                            onClick={handleRevokeAll}
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
