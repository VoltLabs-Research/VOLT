import React from 'react';
import SessionsSettings from '@/features/settings/components/molecules/SessionsSettings';
import useSessions from '@/features/auth/hooks/use-sessions';

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
