import { sshConnectionByIdQuery, sshFilesQuery } from '@/modules/ssh/hooks/queries';
import { useRemoteExplorer } from '@/shared/api/remote-explorer';
import { ErrorSurface, isAccessDeniedError, reportError } from '@/shared/errors/core';
import useAccessDenied from '@/shared/presentation/hooks/use-access-denied';
import { usePageTitle } from '@/shared/presentation/hooks/use-page-title';
import { FileEntryType } from '@/modules/ssh/api/entities/ssh-connection';
import { formatSize } from '@/shared/utils/format';
import { applySearchParamUpdates } from '@/shared/presentation/hooks/use-search-params';
import SSHBreadcrumbs from '@/modules/ssh/components/SSHBreadcrumbs';
import SSHExplorerHeaderLeft from '@/modules/ssh/components/SSHExplorerHeaderLeft';
import SSHExplorerHeaderRight from '@/modules/ssh/components/SSHExplorerHeaderRight';
import FileExplorer from '@/shared/presentation/components/FileExplorer';
import FileExplorerRow from '@/shared/presentation/components/FileExplorer/FileExplorerRow';
import useTip from '@/shared/tips/use-tip';
import { formatDistanceToNow } from 'date-fns';
import { LuFile, LuFolder } from 'react-icons/lu';
import { useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
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
    const [searchParams, setSearchParams] = useSearchParams();
    const selectedEntryPath = searchParams.get('selected') || null;
    const explorerStorageKey = connectionId ? `volt:ssh-explorer:${connectionId}` : null;

    const remoteExplorer = useRemoteExplorer({
        initialPath: explorerStorageKey ? sessionStorage.getItem(explorerStorageKey) || '.' : '.',
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

    useTip('ssh-file-explorer-navigation', {
        enabled: Boolean(connection) && !connectionQuery.isLoading
    });

    usePageTitle(connection?.name ? `${connection.name} - File Explorer` : 'SSH File Explorer');

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

    useEffect(() => {
        if (!explorerStorageKey) {
            return;
        }

        sessionStorage.setItem(explorerStorageKey, remoteExplorer.path);
    }, [explorerStorageKey, remoteExplorer.path]);

    let explorerError: string | null = null;
    if (filesQuery.error) {
        explorerError = reportError(filesQuery.error, {
            surface: ErrorSurface.Silent,
            fallbackTitle: 'Failed to load files'
        }).title;
    }

    const explorer = remoteExplorer.bindState<SSHFileEntry>({
        entries: filesQuery.data?.entries || [],
        cwd: filesQuery.data?.cwd || remoteExplorer.path,
        isLoading: connectionQuery.isLoading || filesQuery.isLoading,
        error: explorerError,
        refresh: filesQuery.refetch,
        isRefreshing: filesQuery.isRefetching
    });

    useEffect(() => {
        if (selectedEntryPath && selectedEntryPath !== explorer.selectedPath) {
            explorer.setSelectedPath(selectedEntryPath);
        }
    }, [explorer, selectedEntryPath]);

    useEffect(() => {
        if ((searchParams.get('selected') || null) === explorer.selectedPath) {
            return;
        }

        setSearchParams((prev) => applySearchParamUpdates(prev, {
            selected: explorer.selectedPath ?? null
        }), { replace: true });
    }, [explorer.selectedPath, searchParams, setSearchParams]);

    const handleEntryClick = (entry: SSHFileEntry) => {
        if (entry.type === FileEntryType.Dir) {
            explorer.navigateTo(entry.relPath);
            return;
        }

        explorer.setSelectedPath(entry.relPath);
    };

    const getEntryIcon = (entry: SSHFileEntry) => {
        return entry.type === FileEntryType.Dir ? <LuFolder /> : <LuFile />;
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

    const headerLeft = (
        <SSHExplorerHeaderLeft
            connectionName={connection?.name}
            cwd={explorer.cwd}
            onBack={goBack}
            onGoUp={explorer.goUp}
        />
    );

    const breadcrumb = <SSHBreadcrumbs cwd={explorer.cwd} onNavigate={explorer.navigateTo} />;
    const headerRight = <SSHExplorerHeaderRight onRefresh={explorer.refresh} isRefreshing={filesQuery.isRefetching} />;
    const helperCopy = explorer.selectedPath
        ? `Selected: ${explorer.selectedPath}`
        : `Browsing ${explorer.cwd}`;
    const explorerRows = explorer.entries.map((entry) => {
        return {
            key: entry.name,
            icon: getEntryIcon(entry),
            onClick: () => handleEntryClick(entry),
            isSelected: explorer.selectedPath === entry.relPath,
            type: entry.type === FileEntryType.Dir ? 'Folder' : 'File',
            size: entry.size !== undefined ? formatSize(entry.size) : undefined,
            date: entry.mtime ? formatDistanceToNow(new Date(entry.mtime), { addSuffix: true }) : undefined,
            name: entry.name
        };
    });

    if (connectionQuery.isLoading) {
        return (
            <div className='d-flex column gap-075 p-2 flex-1 justify-center'>
                <div className='font-size-3 font-weight-6'>Preparing SSH explorer</div>
                <p className='color-secondary'>
                    We are restoring the connection context and the last visited folder.
                </p>
            </div>
        );
    }

    return (
        <FileExplorer
            headerLeft={headerLeft}
            breadcrumb={breadcrumb}
            headerRight={headerRight}
            columns={columns}
            isLoading={explorer.isLoading}
            isEmpty={explorer.entries.length === 0}
            error={explorer.error}
            accessDenied={accessDenied}
            accessDeniedMessage={accessDeniedMessage}
            onRetry={explorer.refresh}
            emptyMessage='No files found in this directory'
        >
            <p className='font-size-1 color-secondary p-075' role='status' aria-live='polite'>
                {helperCopy}. The current folder stays in the URL so you can reload or share this exact location.
            </p>
            {explorerRows.map((entry) => (
                <FileExplorerRow
                    key={entry.key}
                    icon={entry.icon}
                    name={entry.name}
                    type={entry.type}
                    size={entry.size}
                    date={entry.date}
                    isSelected={entry.isSelected}
                    onClick={entry.onClick}
                />
            ))}
        </FileExplorer>
    );
};

export default SSHFileExplorerPage;
