import { sshConnectionByIdQuery, sshFilesQuery } from './queries';
import useAccessDenied from '@/shared/presentation/hooks/use-access-denied';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { sileo } from 'sileo';
import { isAccessDeniedError } from '@/shared/errors/notify-api-error';

interface UseSSHFileExplorerOptions {
    connectionId: string | undefined;
};

const useSSHFileExplorer = ({ connectionId }: UseSSHFileExplorerOptions) => {
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const { accessDenied, accessDeniedMessage, checkRBACError } = useAccessDenied();
    const [selectedPath, setSelectedPath] = useState<string | null>(null);

    const path = searchParams.get('path') || '.';

    const connectionQuery = sshConnectionByIdQuery(
        { sshConnectionId: connectionId || '' },
        { enabled: !!connectionId }
    );

    const connection = useMemo(() => {
        return connectionQuery.data || null;
    }, [connectionQuery.data]);

    useEffect(() => {
        if (connectionQuery.isLoading || !connectionId) {
            return;
        }

        if (connectionQuery.data === null) {
            sileo.error({ title: 'Connection not found' });
            navigate('/dashboard/ssh-connections');
        }
    }, [connectionQuery.data, connectionQuery.isLoading, connectionId, navigate]);

    const filesQuery = sshFilesQuery(
        {
            sshConnectionId: connectionId || '',
            path
        },
        { enabled: !!connectionId && !!connection }
    );

    useEffect(() => {
        if (!connectionQuery.error) {
            return;
        }

        const isRbacError = isAccessDeniedError(connectionQuery.error);
        if (isRbacError) {
            checkRBACError(connectionQuery.error);
        } else if (!connectionQuery.isLoading) {
            sileo.error({ title: 'Failed to load connection' });
        }
    }, [connectionQuery.error, connectionQuery.isLoading, checkRBACError]);

    useEffect(() => {
        if (filesQuery.error) {
            checkRBACError(filesQuery.error);
        }
    }, [filesQuery.error, checkRBACError]);

    const entries = filesQuery.data?.entries || [];
    const cwd = filesQuery.data?.cwd || '';
    const isLoading = connectionQuery.isLoading || filesQuery.isLoading;
    const error = filesQuery.error instanceof Error ? filesQuery.error.message : null;

    const navigateTo = (newPath: string) => {
        setSelectedPath(null);
        if (newPath === '.') {
            setSearchParams({});
        } else {
            setSearchParams({ path: newPath });
        }
    };

    const goUp = () => {
        if (!cwd || cwd === '.' || cwd === '/') {
            return;
        }

        const parts = cwd.split('/');
        parts.pop();
        const newPath = parts.join('/') || '.';
        navigateTo(newPath);
    };

    const goBack = () => {
        navigate('/dashboard/ssh-connections');
    };

    return {
        connection,
        entries,
        cwd,
        isLoading,
        error,
        accessDenied,
        accessDeniedMessage,
        selectedPath,
        setSelectedPath,
        navigateTo,
        goUp,
        goBack,
        refresh: filesQuery.refetch
    };
};

export default useSSHFileExplorer;
