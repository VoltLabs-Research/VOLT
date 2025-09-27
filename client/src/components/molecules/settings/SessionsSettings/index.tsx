import React from 'react';
import { TbDeviceDesktop, TbCheck, TbX } from 'react-icons/tb';
import Section from '@/components/atoms/settings/Section';
import SectionHeader from '@/components/atoms/settings/SectionHeader';
import StatusBadge from '@/components/atoms/StatusBadge';

interface Session { _id: string; userAgent: string; ip: string; lastActivity: string }

interface SessionsSettingsProps {
    sessions: Session[];
    loading: boolean;
    revokeSession: (id: string) => void;
    revokeAllOtherSessions: () => void;
}

const SessionsSettings: React.FC<SessionsSettingsProps> = ({ sessions, loading, revokeSession, revokeAllOtherSessions }) => {
    return (
        <div className='settings-content'>
            <Section>
                <SectionHeader title='Active Sessions' description='Manage your active login sessions across devices' />
                {loading ? (
                    <div className='sessions-loading'>
                        <div className='session-skeleton'>
                            <div className='session-skeleton-icon'></div>
                            <div className='session-skeleton-content'>
                                <div className='session-skeleton-line'></div>
                                <div className='session-skeleton-line short'></div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className='sessions-list'>
                        {sessions.map((session, index) => (
                            <div key={session._id} className={`session-item ${index === 0 ? 'current' : ''}`}>
                                <div className='session-info'>
                                    <div className='session-icon'>
                                        <TbDeviceDesktop size={20} />
                                    </div>
                                    <div className='session-details'>
                                        <span className='session-device'>
                                            {index === 0 ? 'Current Session' : 'Active Session'}
                                        </span>
                                        <span className='session-location'>
                                            {session.userAgent} • {session.ip}
                                        </span>
                                    </div>
                                </div>
                                <div className='session-actions'>
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
                                </div>
                            </div>
                        ))}

                        {sessions.length > 1 && (
                            <div className='session-actions-bulk'>
                                <button className='action-button danger' onClick={revokeAllOtherSessions}>
                                    <TbX size={16} />
                                    Revoke All Other Sessions
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </Section>
        </div>
    );
};

export default SessionsSettings;


