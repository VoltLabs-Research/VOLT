import { useState, useEffect } from 'react';
import sessionApi from '@/features/auth/api/session';

export interface SessionsResponse {
    status: 'success' | 'error';
    results: number;
    data: Session[];
}

export const useSessions = () => {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchSessions = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await sessionApi.getAll();
            setSessions(data);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to fetch sessions');
        } finally {
            setLoading(false);
        }
    };

    const revokeSession = async (sessionId: string) => {
        try {
            await sessionApi.revoke(sessionId);
            setSessions(prev => prev.filter(session => session._id !== sessionId));
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to revoke session');
        }
    };

    const revokeAllOtherSessions = async () => {
        try {
            await sessionApi.revokeOthers();
            setSessions(prev => prev.slice(0, 1));
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to revoke other sessions');
        }
    };

    useEffect(() => {
        fetchSessions();
    }, []);

    return {
        sessions,
        loading,
        error,
        refetch: fetchSessions,
        revokeSession,
        revokeAllOtherSessions
    };
};

export default useSessions;
