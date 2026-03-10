import { sshConnectionByIdQuery, sshFilesQuery } from '@/modules/ssh/hooks/queries';
import { useRemoteExplorer } from '@/shared/api/remote-explorer';
import { isAccessDeniedError } from '@/shared/errors/notify-api-error';
import useAccessDenied from '@/shared/presentation/hooks/use-access-denied';
import { FileEntryType } from '@/modules/ssh/api/entities/ssh-connection';
import { formatSize } from '@/shared/utils/format';
import SSHBreadcrumbs from '@/modules/ssh/components/atoms/SSHBreadcrumbs';
import SSHExplorerHeaderLeft from '@/modules/ssh/components/atoms/SSHExplorerHeaderLeft';
import SSHExplorerHeaderRight from '@/modules/ssh/components/atoms/SSHExplorerHeaderRight';
import FileExplorer from '@/shared/presentation/components/FileExplorer';
import FileExplorerRow from '@/shared/presentation/components/FileExplorer/FileExplorerRow';
import { formatDistanceToNow } from 'date-fns';
import { LuFile, LuFolder } from 'react-icons/lu';
import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { sileo } from 'sileo';
import type { SSHFileEntry } from '@/modules/ssh/api/entities/ssh-connection';

interface SSHFileExplorerPageProps {
    connectionId?: string;
};

type SSHFileExplorerRouteParams = Record<'connectionId', string>;

const SSHFileExplorerPage = ({ connectionId: propConnectionId }: SSHFileExplorerPageProps) => {
    const params = useParams<SSHFileExplorerRouteParams>();
    const navigate = useNavigate();
    const connectionId = propConnectionId || params.connectionId;
    const { accessDenied, accessDeniedMessage, checkAccessDeniedError } = useAccessDenied();

    const remoteExplorer = useRemoteExplorer({
        initialPath: '.',
        normalizeRootPath: (path) => {
            if (!path || path === '/') {
                return '.';
            }

            return path;
        }
    });

    const connectionQuery = sshConnectionByIdQuery(
        { sshConnectionId: connectionId || '' },
        { enabled: !!connectionId }
    );
    const connection = connectionQuery.data || null;

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
            path: remoteExplorer.path
        },
        { enabled: !!connectionId && !!connection }
    );

    useEffect(() => {
        if (!connectionQuery.error) {
            return;
        }

        if (isAccessDeniedError(connectionQuery.error)) {
            checkAccessDeniedError(connectionQuery.error);
        } else if (!connectionQuery.isLoading) {
            sileo.error({ title: 'Failed to load connection' });
        }
    }, [connectionQuery.error, connectionQuery.isLoading, checkAccessDeniedError]);

    useEffect(() => {
        if (filesQuery.error) {
            checkAccessDeniedError(filesQuery.error);
        }
    }, [filesQuery.error, checkAccessDeniedError]);

    const explorer = remoteExplorer.bindState<SSHFileEntry>({
        entries: filesQuery.data?.entries || [],
        cwd: filesQuery.data?.cwd || remoteExplorer.path,
        isLoading: connectionQuery.isLoading || filesQuery.isLoading,
        error: filesQuery.error instanceof Error ? filesQuery.error.message : null,
        refresh: filesQuery.refetch
    });

    const handleEntryClick = (entry: SSHFileEntry) => {
        explorer.setSelectedPath(entry.relPath);
    };

    const handleEntryDoubleClick = (entry: SSHFileEntry) => {
        if (entry.type === FileEntryType.Dir) {
            explorer.navigateTo(entry.relPath);
        }
    };

    const goBack = () => {
        navigate('/dashboard/ssh-connections');
    };

    const columns = (
        <>
            <span>Name</span>
            <span>Type</span>
            <span>Size</span>
            <span>Modified</span>
        </>
    );

    return (
        <FileExplorer
            headerLeft={
                <SSHExplorerHeaderLeft
                    connectionName={connection?.name}
                    cwd={explorer.cwd}
                    onBack={goBack}
                    onGoUp={explorer.goUp}
                />
            }
            breadcrumb={<SSHBreadcrumbs cwd={explorer.cwd} onNavigate={explorer.navigateTo} />}
            headerRight={<SSHExplorerHeaderRight onRefresh={() => {
                void explorer.refresh();
            }} />}
            columns={columns}
            isLoading={explorer.isLoading}
            isEmpty={explorer.entries.length === 0}
            error={explorer.error}
            accessDenied={accessDenied}
            accessDeniedMessage={accessDeniedMessage}
            onRetry={() => {
                void explorer.refresh();
            }}
            emptyMessage='No files found in this directory'
        >
            {explorer.entries.map((entry) => (
                <FileExplorerRow
                    key={entry.name}
                    icon={entry.type === FileEntryType.Dir ? <LuFolder /> : <LuFile />}
                    name={entry.name}
                    type={entry.type === FileEntryType.Dir ? 'Folder' : 'File'}
                    size={entry.size !== undefined ? formatSize(entry.size) : undefined}
                    date={entry.mtime ? formatDistanceToNow(new Date(entry.mtime), { addSuffix: true }) : undefined}
                    isSelected={explorer.selectedPath === entry.relPath}
                    onClick={() => handleEntryClick(entry)}
                    onDoubleClick={() => handleEntryDoubleClick(entry)}
                />
            ))}
        </FileExplorer>
    );
};

export default SSHFileExplorerPage;
