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
import { EmptyState } from '@/shared/presentation/primitives';
import { Button, ListRow, Modal, Row, Skeleton, Stack, StatusBadge, StatusDot, Text } from '@/shared/presentation/primitives';
import { Globe, Monitor, Shield, Smartphone } from 'lucide-react';
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
            <ListRow
                key={session._id}
                as='li'
                className={`session-card ${isCurrent ? 'current-session' : ''}`}
                leading={<DeviceIcon size={20} className='color-muted' />}
                title={
                    <Row gap='05' wrap>
                        <span>{meta.browser} on {meta.os}</span>
                        {isCurrent && (
                            <StatusBadge variant='brand' size='compact'>Current</StatusBadge>
                        )}
                    </Row>
                }
                meta={
                    <Row gap='05' wrap>
                        <Text as='span' tone='muted' size='sm' className='font-mono'>
                            {session.ip}
                        </Text>
                        <Text as='span' tone='muted' size='sm' className='font-mono'>
                            Token {meta.tokenInfo}
                        </Text>
                        <Text as='span' tone='muted' size='sm'>
                            · {formatSessionRelativeTime(session.lastActivity)}
                        </Text>
                    </Row>
                }
                trailing={
                    <Row gap='05' wrap justify='end' className='session-card-actions'>
                        <StatusBadge
                            variant={SESSION_ACTION_VARIANTS[session.action]}
                            size='compact'
                        >
                            {SESSION_ACTION_LABELS[session.action]}
                        </StatusBadge>
                        {!isCurrent && (
                            <Button
                                variant='ghost'
                                intent='danger'
                                size='sm'
                                onClick={() => openRevokeSessionModal(session)}
                            >
                                Revoke
                            </Button>
                        )}
                    </Row>
                }
            />
        );
    };

    const renderActivity = (activity: LoginActivityEntry, index: number) => {
        const { browser, os } = parseSessionUserAgent(activity.userAgent);
        const ActionIcon = getSessionActivityIcon(activity.action);

        return (
            <ListRow
                key={`${activity._id}-${index}`}
                as='li'
                className='session-activity-row'
                leading={<ActionIcon size={16} className='color-muted' />}
                title={`${SESSION_ACTION_LABELS[activity.action]} · ${browser} on ${os}`}
                meta={
                    <Row gap='05' wrap>
                        <Text as='span' tone='muted' size='sm' className='font-mono'>
                            {activity.ip}
                        </Text>
                        <Text as='span' tone='muted' size='sm'>
                            · {formatSessionRelativeTime(activity.createdAt)}
                        </Text>
                    </Row>
                }
                trailing={
                    <Row gap='05'>
                        <StatusDot tone={activity.success ? 'success' : 'danger'} size='sm' />
                        <StatusBadge
                            variant={activity.success ? 'success' : 'danger'}
                            size='compact'
                        >
                            {activity.success ? 'Success' : 'Failed'}
                        </StatusBadge>
                    </Row>
                }
            />
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
            <Row key={i} gap='1' p='075'>
                <Skeleton variant="circular" width={36} height={36} />
                <Stack flex='1' gap='025'>
                    <Skeleton variant="text" width="40%" height={20} />
                    <Skeleton variant="text" width="25%" height={16} />
                </Stack>
                <Skeleton variant="rounded" width={60} height={28} />
            </Row>
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
            <Row key={i} gap='1' p='05'>
                <Skeleton variant="circular" width={6} height={6} />
                <Stack flex='1' gap='025'>
                    <Skeleton variant="text" width="35%" height={18} />
                    <Skeleton variant="text" width="20%" height={14} />
                </Stack>
                <Skeleton variant="rounded" width={50} height={22} />
            </Row>
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
                    <Text as='p' size='md' tone='muted' className='p-1-5'>
                        Are you sure you want to revoke the session from{' '}
                        <strong>{parseSessionUserAgent(revokeTarget.userAgent).browser}</strong> on{' '}
                        <strong>{parseSessionUserAgent(revokeTarget.userAgent).os}</strong> ({revokeTarget.ip})?
                    </Text>
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
                <Text as='p' size='md' tone='muted' className='p-1-5'>
                    Are you sure you want to revoke {otherSessionsCount} other{' '}
                    {otherSessionsCount === 1 ? 'session' : 'sessions'}? This action cannot be undone.
                </Text>
            </Modal>
        </SettingsPage>
    );
};

export default SessionSettings;
