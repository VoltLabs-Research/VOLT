import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import useSSHUseCases from './use-ssh-use-cases';
import useToast from '@/shared/presentation/hooks/use-toast';
import type { SSHConnection, SSHFileEntry } from '@/modules/ssh/domain/entities';

interface UseSSHFileExplorerOptions {
    connectionId: string | undefined;
};

const useSSHFileExplorer = ({ connectionId }: UseSSHFileExplorerOptions) => {
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const { showError } = useToast();
    const { sshRepository } = useSSHUseCases();

    const [connection, setConnection] = useState<SSHConnection | null>(null);
    const [entries, setEntries] = useState<SSHFileEntry[]>([]);
    const [cwd, setCwd] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedPath, setSelectedPath] = useState<string | null>(null);

    const path = searchParams.get('path') || '.';

    const fetchConnection = async () => {
        if (!connectionId) return;
        try {
            const result = await sshRepository.getConnections({ limit: 100 });
            const conn = result.data.find((c: SSHConnection) => c._id === connectionId);
            if (conn) {
                setConnection(conn);
            } else {
                showError('Connection not found');
                navigate('/dashboard/ssh-connections');
            }
        } catch {
            showError('Failed to load connection');
            navigate('/dashboard/ssh-connections');
        }
    };

    const fetchFiles = async () => {
        if (!connectionId) return;
        setIsLoading(true);
        setError(null);
        try {
            const result = await sshRepository.listFiles({ connectionId, path });
            setEntries(result.entries);
            setCwd(result.cwd);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to load files';
            setError(message);
            showError(message);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchConnection();
    }, [connectionId]);

    useEffect(() => {
        if (connection) {
            fetchFiles();
        }
    }, [connection?._id, path]);

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
        selectedPath,
        setSelectedPath,
        navigateTo,
        goUp,
        goBack,
        refresh: fetchFiles
    };
};

export default useSSHFileExplorer;
