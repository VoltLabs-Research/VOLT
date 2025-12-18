import React from 'react';
import SessionsSettings from '@/components/molecules/settings/SessionsSettings';
import useSessions from '@/hooks/auth/use-sessions';

const SessionsPage: React.FC = () => {
    const { sessions, loading, revokeSession, revokeAllOtherSessions } = useSessions();

    return (
        <SessionsSettings
            sessions={sessions}
            loading={loading}
            revokeSession={revokeSession}
            revokeAllOtherSessions={revokeAllOtherSessions}
        />
    );
};

export default SessionsPage;
