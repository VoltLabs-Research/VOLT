import React from 'react';
import { TbDeviceDesktop, TbCheck, TbX } from 'react-icons/tb';
import Section from '@/components/atoms/settings/Section';
import SectionHeader from '@/components/atoms/settings/SectionHeader';
import StatusBadge from '@/components/atoms/common/StatusBadge';
import Container from '@/components/primitives/Container';

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
                    <Container className='session-skeleton d-flex items-center gap-1'>
                        <Container className='session-skeleton-icon'></Container>
                        <Container className='session-skeleton-content'>
                            <Container className='session-skeleton-line'></Container>
                            <Container className='session-skeleton-line short'></Container>
                        </Container>
                    </Container>
                </Container>
            ) : (
                <Container className='d-flex column gap-1'>
                    {sessions.map((session, index) => (
                        <Container 
                            key={session._id} 
                            className={`d-flex items-center content-between session-item sm:column sm:items-start sm:gap-1 ${index === 0 ? 'current' : ''}`}
                        >
                            <Container className='d-flex items-center gap-1'>
                                <Container className='d-flex flex-center session-icon'>
                                    <TbDeviceDesktop size={20} />
                                </Container>
                                <Container className='d-flex column gap-025'>
                                    <span className='session-device'>
                                        {index === 0 ? 'Current Session' : 'Active Session'}
                                    </span>
                                    <span className='session-location'>
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
                                    <button className='action-button danger' onClick={() => revokeSession(session._id)}>
                                        <TbX size={16} />
                                        Revoke
                                    </button>
                                )}
                            </Container>
                        </Container>
                    ))}

                    {sessions.length > 1 && (
                        <Container className='d-flex content-center session-actions-bulk'>
                            <button className='action-button danger' onClick={revokeAllOtherSessions}>
                                <TbX size={16} />
                                Revoke All Other Sessions
                            </button>
                        </Container>
                    )}
                </Container>
            )}
        </Section>
    );
};

export default SessionsSettings;
