import React from 'react';
import { TbDeviceDesktop, TbCheck, TbX } from 'react-icons/tb';
import Section from '@/features/settings/atoms/Section';
import SectionHeader from '@/features/settings/atoms/SectionHeader';
import StatusBadge from '@/components/atoms/common/StatusBadge';
import Container from '@/components/primitives/Container';
import Button from '@/components/primitives/Button';

interface Session {
    _id: string;
    userAgent: string;
    ip: string;
    lastActivity: string;
};

interface SessionsSettingsProps {
    sessions: Session[];
    loading: boolean;
    revokeSession: (id: string) => void;
    revokeAllOtherSessions: () => void;
};

const SessionsSettings: React.FC<SessionsSettingsProps> = ({ sessions, loading, revokeSession, revokeAllOtherSessions }) => {
    return (
        <Section>
            <SectionHeader
                title='Active Sessions'
                description='Manage your active login sessions across devices' />

            {loading ? (
                <Container className='d-flex column gap-1'>
                    <Container className='session-skeleton d-flex items-center gap-1 p-1'>
                        <Container className='session-skeleton-icon'></Container>
                        <Container className='flex-1 d-flex column gap-05 session-skeleton-content'>
                            <Container className='session-skeleton-line'></Container>
                            <Container className='session-skeleton-line short'></Container>
                        </Container>
                    </Container>
                </Container>
            ) : (
                <Container className='d-flex column gap-2 max-h-500 y-scroll'>
                    {sessions.map((session, index) => (
                        <Container
                            key={session._id}
                            className={`d-flex b-soft p-1-5 b-radius-08 items-center content-between session-item sm:column sm:items-start sm:gap-1 ${index === 0 ? 'current' : ''} p-1`}
                        >
                            <Container className='d-flex items-center gap-1'>
                                <Container className='d-flex flex-center session-icon'>
                                    <TbDeviceDesktop size={20} />
                                </Container>
                                <Container className='d-flex column gap-025'>
                                    <span className='session-device font-weight-5 color-primary font-size-3'>
                                        {index === 0 ? 'Current Session' : 'Active Session'}
                                    </span>
                                    <span className='session-location color-secondary font-size-2'>
                                        {session.userAgent} • {session.ip}
                                    </span>
                                </Container>
                            </Container>
                            <Container className='d-flex items-center gap-05'>
                                {index === 0 ? (
                                    <StatusBadge variant='active'>
                                        <TbCheck size={14} />
                                        Current
                                    </StatusBadge>
                                ) : (
                                    <Button variant='soft' intent='danger' size='sm' leftIcon={<TbX size={16} />} onClick={() => revokeSession(session._id)}>
                                        Revoke
                                    </Button>
                                )}
                            </Container>
                        </Container>
                    ))}
                </Container>
            )}

            {sessions.length > 1 && (
                <Container className='d-flex content-center session-actions-bulk mt-1'>
                    <Button variant='soft' intent='danger' size='sm' leftIcon={<TbX size={16} />} onClick={revokeAllOtherSessions}>
                        Revoke All Other Sessions
                    </Button>
                </Container>
            )}
        </Section>
    );
};

export default SessionsSettings;
