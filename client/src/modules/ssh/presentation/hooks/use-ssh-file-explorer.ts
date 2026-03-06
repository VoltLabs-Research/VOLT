import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import useSSHUseCases from './use-ssh-repository';
import { sileo } from 'sileo';
import useAccessDenied from '@/shared/presentation/hooks/use-access-denied';
import type { SSHConnection, SSHFileEntry } from '@/modules/ssh/domain/entities';

interface UseSSHFileExplorerOptions {
    connectionId: string | undefined;
};

const useSSHFileExplorer = ({ connectionId }: UseSSHFileExplorerOptions) => {
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const { sshRepository } = useSSHUseCases();
    const { accessDenied, accessDeniedMessage, checkRBACError } = useAccessDenied();

    const [connection, setConnection] = useState<SSHConnection | null>(null);
    const [entries, setEntries] = useState<SSHFileEntry[]>([]);
    const [cwd, setCwd] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedPath, setSelectedPath] = useState<string | null>(null);
    const connectionRequestIdRef = useRef(0);
    const filesRequestIdRef = useRef(0);

    const path = searchParams.get('path') || '.';

    const fetchConnection = useCallback(async () => {
        if (!connectionId) {
            return;
        }

        const requestId = ++connectionRequestIdRef.current;

        try {
            const result = await sshRepository.getConnections({ limit: 100 });
            if (requestId !== connectionRequestIdRef.current) {
                return;
            }

            const matchedConnection = result.data.find((connectionItem: SSHConnection) => connectionItem._id === connectionId);
            if (matchedConnection) {
                setConnection(matchedConnection);
                return;
            }

            sileo.error({ title: 'Connection not found' });
            navigate('/dashboard/ssh-connections');
        } catch(error: unknown) {
            if (requestId !== connectionRequestIdRef.current) {
                return;
            }

            if(checkRBACError(error)) {
                return;
            }

            sileo.error({ title: 'Failed to load connection' });
            navigate('/dashboard/ssh-connections');
        }
    }, [checkRBACError, connectionId, navigate, sshRepository]);

    const fetchFiles = useCallback(async () => {
        if (!connectionId) {
            return;
        }

        const requestId = ++filesRequestIdRef.current;
        setIsLoading(true);
        setError(null);

        try {
            const result = await sshRepository.listFiles({ connectionId, path });
            if (requestId !== filesRequestIdRef.current) {
                return;
            }

            setEntries(result.entries);
            setCwd(result.cwd);
        } catch (error: unknown) {
            if (requestId !== filesRequestIdRef.current) {
                return;
            }

            if (checkRBACError(error)) {
                return;
            }

            const message = error instanceof Error ? error.message : 'Failed to load files';
            setError(message);
            sileo.error({ title: message });
        } finally {
            if (requestId === filesRequestIdRef.current) {
                setIsLoading(false);
            }
        }
    }, [checkRBACError, connectionId, path, sshRepository]);

    useEffect(() => {
        setConnection(null);
        setEntries([]);
        setCwd('');
        setError(null);
        setSelectedPath(null);

        if (!connectionId) {
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        void fetchConnection();

        return () => {
            connectionRequestIdRef.current += 1;
            filesRequestIdRef.current += 1;
        };
    }, [connectionId, fetchConnection]);

    useEffect(() => {
        if (connection) {
            setEntries([]);
            void fetchFiles();
        }
        return () => {
            filesRequestIdRef.current += 1;
        };
    }, [connection?._id, fetchFiles, path]);

    const navigateTo = (newPath: string) => {
        setSelectedPath(null);
        setSearchParams(newPath === '.' ? {} : { path: newPath });
    };

    const goUp = () => {
        if (!cwd || cwd === '.' || cwd === '/') return;
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
        refresh: fetchFiles
    };
};

export default useSSHFileExplorer;
