import React from 'react';
import SessionsSettings from '@/modules/settings/presentation/components/molecules/SessionsSettings';
import useSessions from '@/modules/auth/presentation/hooks/use-sessions';

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
