import { TeamClusterRemoteAccessTarget, TeamClusterRemoteExplorerContentType, TeamClusterRemoteExplorerEntryType } from '@/modules/cluster/api/entities/team-cluster-remote-access';
import ClusterMongoDocumentViewer from '@/modules/cluster/components/ClusterMongoDocumentViewer';
import useDashboardHeaderContent from '@/modules/dashboard/hooks/use-dashboard-header-content';
import JsonTree from '@/modules/plugin/components/plugin/JsonTree';
import { useRemoteExplorer } from '@/shared/api/remote-explorer';
import { triggerBrowserDownload } from '@/shared/utils/file';
import { showPromise } from '@/shared/presentation/hooks/toast';
import { copyTextToClipboard } from '@/shared/presentation/utilities/copy-to-clipboard';
import { Box, Stack, Row, Text, Button, IconButton, SearchInput } from '@/shared/presentation/primitives';
import FileExplorer from '@/shared/presentation/components/FileExplorer';
import FileExplorerRow from '@/shared/presentation/components/FileExplorer/FileExplorerRow';
import RefreshButton from '@/shared/presentation/components/RefreshButton';
import { decode } from '@msgpack/msgpack';
import { Database, Download, FileJson, FolderOpen, HardDrive, Package, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './ClusterRemoteExplorerContent.css';
import type { FolderBreadcrumbItem } from '@/shared/presentation/hooks/use-folder-breadcrumbs';
import type {
    TeamClusterRemoteAccessSession,
    TeamClusterRemoteExplorerEntry,
    TeamClusterRemoteExplorerNode
} from '@/modules/cluster/api/entities/team-cluster-remote-access';
import type { TeamCluster } from '@/modules/cluster/api/entities/team-cluster';

type LucideIconComponent = typeof Database;

interface ClusterRemoteExplorerContentProps {
    teamCluster: TeamCluster;
    target: TeamClusterRemoteAccessTarget;
    session: TeamClusterRemoteAccessSession;
    listEntries: (
        teamClusterId: string,
        sessionId: string,
        target: TeamClusterRemoteAccessTarget,
        path: string
    ) => Promise<TeamClusterRemoteExplorerEntry[]>;
    getNode: (
        teamClusterId: string,
        sessionId: string,
        target: TeamClusterRemoteAccessTarget,
        path: string
    ) => Promise<TeamClusterRemoteExplorerNode>;
    downloadObject: (
        teamClusterId: string,
        sessionId: string,
        target: TeamClusterRemoteAccessTarget,
        path: string
    ) => Promise<Blob>;
};

const toExplorerPath = (path: string): string => {
    return path ? `/${path.replace(/^\/+/g, '')}` : '/';
};

const toApiPath = (path: string): string => {
    return path === '/'
        ? ''
        : path.replace(/^\/+/g, '');
};

const isNavigableEntry = (entry: TeamClusterRemoteExplorerEntry): boolean => {
    return entry.type === TeamClusterRemoteExplorerEntryType.Directory
        || entry.type === TeamClusterRemoteExplorerEntryType.Bucket
        || entry.type === TeamClusterRemoteExplorerEntryType.RedisDatabase;
};

/** Returns true when the entry represents a leaf resource that can be downloaded. */
const isDownloadableEntry = (entry: TeamClusterRemoteExplorerEntry): boolean => {
    return entry.type === TeamClusterRemoteExplorerEntryType.Object
        || entry.type === TeamClusterRemoteExplorerEntryType.Collection
        || entry.type === TeamClusterRemoteExplorerEntryType.RedisKey;
};

/** Returns true when the entry is a MinIO object eligible for MsgPack decoding. */
const isMsgpackDecodable = (
    entry: TeamClusterRemoteExplorerEntry,
    currentTarget: TeamClusterRemoteAccessTarget
): boolean => {
    return currentTarget === TeamClusterRemoteAccessTarget.Minio
        && entry.type === TeamClusterRemoteExplorerEntryType.Object;
};

const getEntryIcon = (entry: TeamClusterRemoteExplorerEntry): LucideIconComponent => {
    if (entry.type === TeamClusterRemoteExplorerEntryType.Bucket || entry.type === TeamClusterRemoteExplorerEntryType.Directory) {
        return FolderOpen;
    }

    if (entry.type === TeamClusterRemoteExplorerEntryType.RedisDatabase) {
        return HardDrive;
    }

    if (entry.type === TeamClusterRemoteExplorerEntryType.Object) {
        return Package;
    }

    return Database;
};

/**
 * Renders the shared file-explorer UI for cluster remote resources (Mongo, Redis, MinIO).
 * This is the content-only component without any modal wrapper,
 * intended to be embedded in a full-page layout.
 */
const ClusterRemoteExplorerContent = ({
    teamCluster,
    target,
    session,
    listEntries,
    getNode,
    downloadObject
}: ClusterRemoteExplorerContentProps) => {
    const remoteExplorer = useRemoteExplorer({
        initialPath: '/',
        normalizeRootPath: (path) => path || '/',
        pathParam: 'clusterExplorerPath'
    });

    const [entries, setEntries] = useState<TeamClusterRemoteExplorerEntry[]>([]);
    const [entriesError, setEntriesError] = useState<string | null>(null);
    const [isEntriesLoading, setIsEntriesLoading] = useState(false);
    const [isEntriesRefreshing, setIsEntriesRefreshing] = useState(false);
    const [node, setNode] = useState<TeamClusterRemoteExplorerNode | null>(null);
    const [nodeError, setNodeError] = useState<string | null>(null);
    const [isNodeLoading, setIsNodeLoading] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [msgpackDecoded, setMsgpackDecoded] = useState<Record<string, unknown> | unknown[] | null>(null);
    const [isMsgpackDecoding, setIsMsgpackDecoding] = useState(false);
    const [msgpackError, setMsgpackError] = useState<string | null>(null);
    const [filterQuery, setFilterQuery] = useState('');
    const [isDetailsVisible, setIsDetailsVisible] = useState(true);

    const remoteExplorerRef = useRef(remoteExplorer);
    remoteExplorerRef.current = remoteExplorer;

    useEffect(() => {
        remoteExplorer.navigateTo('/');
    }, [session.sessionId, target]);

    const loadEntries = async (refresh = false) => {
        if (refresh) {
            setIsEntriesRefreshing(true);
        } else {
            setIsEntriesLoading(true);
        }

        try {
            const nextEntries = await listEntries(
                teamCluster._id,
                session.sessionId,
                target,
                toApiPath(explorerState.path)
            );
            setEntries(nextEntries);
            setEntriesError(null);
        } catch (error: unknown) {
            setEntriesError(error instanceof Error ? error.message : 'Failed to load remote explorer entries');
        } finally {
            setIsEntriesLoading(false);
            setIsEntriesRefreshing(false);
        }
    };

    const explorerState = remoteExplorer.bindState({
        entries,
        cwd: remoteExplorer.path,
        isLoading: isEntriesLoading,
        error: entriesError,
        refresh: () => loadEntries(true),
        isRefreshing: isEntriesRefreshing
    });

    useEffect(() => {
        loadEntries();
    }, [teamCluster._id, session.sessionId, target, explorerState.path]);

    useEffect(() => {
        setFilterQuery('');
    }, [explorerState.path]);

    const filteredEntries = useMemo(() => {
        const query = filterQuery.trim().toLowerCase();
        if (!query) {
            return entries;
        }
        return entries.filter((entry) => entry.name.toLowerCase().includes(query));
    }, [entries, filterQuery]);

    const handleBreadcrumbNavigate = useCallback((id: string | null) => {
        remoteExplorerRef.current.navigateTo(id ?? '/');
    }, []);

    const globalSearchBreadcrumb = useMemo(() => {
        const cwd = explorerState.cwd;
        if (!cwd || cwd === '/') {
            return null;
        }

        const segments = cwd.split('/').filter(Boolean);
        const items: FolderBreadcrumbItem[] = [{ id: null, title: 'Root' }];
        segments.forEach((segment, index) => {
            items.push({
                id: '/' + segments.slice(0, index + 1).join('/'),
                title: segment
            });
        });

        return {
            items,
            onNavigate: handleBreadcrumbNavigate
        };
    }, [explorerState.cwd, handleBreadcrumbNavigate]);

    useDashboardHeaderContent({ globalSearchBreadcrumb });

    const selectedEntry = useMemo(() => {
        return entries.find((entry) => toExplorerPath(entry.path) === explorerState.selectedPath) ?? null;
    }, [entries, explorerState.selectedPath]);

    useEffect(() => {
        if (selectedEntry && !isNavigableEntry(selectedEntry)) {
            setIsDetailsVisible(true);
        }
    }, [explorerState.selectedPath]);

    useEffect(() => {
        if (!selectedEntry || isNavigableEntry(selectedEntry)) {
            setNode(null);
            setNodeError(null);
            setMsgpackDecoded(null);
            setMsgpackError(null);
            return;
        }

        setMsgpackDecoded(null);
        setMsgpackError(null);
        setIsNodeLoading(true);

        getNode(teamCluster._id, session.sessionId, target, selectedEntry.path)
            .then((nextNode) => {
                setNode(nextNode);
                setNodeError(null);
            })
            .catch((error: unknown) => {
                setNode(null);
                setNodeError(error instanceof Error ? error.message : 'Failed to load remote explorer node');
            })
            .finally(() => {
                setIsNodeLoading(false);
            });
    }, [teamCluster._id, session.sessionId, target, selectedEntry?.path]);

    const handleEntryClick = (entry: TeamClusterRemoteExplorerEntry) => {
        explorerState.setSelectedPath(toExplorerPath(entry.path));
    };

    const handlePathCopy = async () => {
        if (!selectedEntry) {
            return;
        }

        await copyTextToClipboard(selectedEntry.path, {
            successMessage: 'Path copied to clipboard'
        });
    };

    const handleEntryDoubleClick = (entry: TeamClusterRemoteExplorerEntry) => {
        if (!isNavigableEntry(entry)) {
            explorerState.setSelectedPath(toExplorerPath(entry.path));
            return;
        }

        explorerState.navigateTo(toExplorerPath(entry.path));
    };

    const handleDownload = async () => {
        if (!selectedEntry || !isDownloadableEntry(selectedEntry)) return;

        setIsDownloading(true);

        try {
            const blob = await showPromise(
                downloadObject(teamCluster._id, session.sessionId, target, selectedEntry.path),
                {
                    loading: { title: 'Downloading...' },
                    success: { title: 'Download complete' },
                    error: { title: 'Failed to download' }
                }
            );

            const filename = selectedEntry.name || selectedEntry.path.split('/').pop() || 'download';
            triggerBrowserDownload(blob, filename);
        } finally {
            setIsDownloading(false);
        }
    };

    const handleDecodeMsgpack = async () => {
        if (!selectedEntry || !isDownloadableEntry(selectedEntry)) return;

        setIsMsgpackDecoding(true);
        setMsgpackError(null);
        setMsgpackDecoded(null);

        try {
            const blob = await showPromise(
                downloadObject(teamCluster._id, session.sessionId, target, selectedEntry.path),
                {
                    loading: { title: 'Fetching object...' },
                    success: { title: 'Object fetched' },
                    error: { title: 'Failed to fetch object' }
                }
            );

            const buffer = await blob.arrayBuffer();
            const decoded = decode(new Uint8Array(buffer));

            if (typeof decoded === 'object' && decoded !== null) {
                setMsgpackDecoded(decoded as Record<string, unknown> | unknown[]);
            } else {
                setMsgpackDecoded({ value: decoded });
            }
        } catch {
            setMsgpackError('Failed to decode as MsgPack. The file may not be in MsgPack format.');
        } finally {
            setIsMsgpackDecoding(false);
        }
    };

    const renderEntryRow = (entry: TeamClusterRemoteExplorerEntry) => {
        const Icon = getEntryIcon(entry);

        return (
            <FileExplorerRow
                key={entry.id}
                icon={<Icon size={16} />}
                name={entry.name}
                type={entry.type}
                size={entry.size !== null ? String(entry.size) : undefined}
                date={entry.updatedAt ?? entry.description ?? undefined}
                isSelected={explorerState.selectedPath === toExplorerPath(entry.path)}
                onClick={() => handleEntryClick(entry)}
                onDoubleClick={() => handleEntryDoubleClick(entry)}
            />
        );
    };

    const columns = (
        <>
            <span>Name</span>
            <span>Type</span>
            <span>Size</span>
            <span>Details</span>
        </>
    );

    const headerLeft = (
        <SearchInput
            variant='small'
            placeholder='Filter in current location'
            value={filterQuery}
            aria-label='Filter entries in current directory'
            onChange={(event) => setFilterQuery(event.target.value)}
            containerClassName='cluster-remote-explorer-filter'
        />
    );

    const headerRight = (
        <RefreshButton
            label='Refresh'
            variant='outline'
            intent='white'
            onClick={() => {
                loadEntries(true);
            }}
            isLoading={isEntriesRefreshing}
        />
    );

    const detailContent = useMemo(() => {
        if (isNodeLoading) {
            return (
                <Row justify='center' className='cluster-remote-explorer-empty'>
                    <Text as='p' size='md' tone='secondary'>Loading resource details...</Text>
                </Row>
            );
        }

        if (nodeError) {
            return (
                <Row justify='center' className='cluster-remote-explorer-empty'>
                    <Text as='p' size='md' tone='secondary'>{nodeError}</Text>
                </Row>
            );
        }

        if (!selectedEntry || !node) {
            return (
                <Row justify='center' className='cluster-remote-explorer-empty'>
                    <Text as='p' size='md' tone='secondary'>Select an entry to inspect its details.</Text>
                </Row>
            );
        }

        if (msgpackError) {
            return (
                <Row justify='center' className='cluster-remote-explorer-empty'>
                    <Text as='p' size='md' tone='secondary'>{msgpackError}</Text>
                </Row>
            );
        }

        if (msgpackDecoded) {
            return (
                <Box p='1' radius='md' overflow='auto' flex='1' className='cluster-remote-explorer-detail-body'>
                    <JsonTree data={msgpackDecoded} />
                </Box>
            );
        }

        if (node.contentType === TeamClusterRemoteExplorerContentType.MongoDocuments) {
            return <ClusterMongoDocumentViewer documents={node.mongoDocuments} />;
        }

        if (node.contentType === TeamClusterRemoteExplorerContentType.Text) {
            return (
                <Box p='1' radius='md' overflow='auto' flex='1' className='cluster-remote-explorer-detail-body'>
                    <pre className='cluster-remote-explorer-detail-pre'>{node.textContent}</pre>
                </Box>
            );
        }

        return (
            <Row justify='center' className='cluster-remote-explorer-empty'>
                <Text as='p' size='md' tone='secondary'>This entry does not expose a preview.</Text>
            </Row>
        );
    }, [isNodeLoading, nodeError, node, selectedEntry, msgpackDecoded, msgpackError]);

    const shouldShowFloatingDetail = Boolean(selectedEntry) && !!selectedEntry && !isNavigableEntry(selectedEntry) && isDetailsVisible;
    const SelectedEntryIcon = selectedEntry ? getEntryIcon(selectedEntry) : Database;

    return (
        <Box className='cluster-remote-explorer-layout'>
            <Box radius='md' overflow='hidden' className='cluster-remote-explorer-panel cluster-remote-explorer-main'>
                <FileExplorer
                    headerLeft={headerLeft}
                    headerRight={headerRight}
                    columns={columns}
                    isLoading={isEntriesLoading}
                    isEmpty={!entriesError && filteredEntries.length === 0}
                    emptyMessage={
                        filterQuery && entries.length > 0
                            ? `No entries matching "${filterQuery}"`
                            : 'No entries found'
                    }
                    error={entriesError}
                    onRetry={() => {
                        loadEntries(true);
                    }}
                    isRetrying={isEntriesRefreshing}
                >
                    {filteredEntries.map(renderEntryRow)}
                </FileExplorer>
            </Box>

            {shouldShowFloatingDetail && selectedEntry && (
                <Box radius='lg' className='cluster-remote-explorer-detail' role='region' aria-label={`Details for ${selectedEntry.name}`}>
                    <IconButton
                        className='cluster-remote-explorer-detail-close'
                        onClick={() => setIsDetailsVisible(false)}
                        size='sm'
                        variant='ghost'
                        title='Close details'
                        aria-label='Close details'
                    >
                        <X size={14} />
                    </IconButton>

                    <Row gap='075' className='cluster-remote-explorer-detail-summary'>
                        <Box display='flex' shrink='0' className='cluster-remote-explorer-detail-icon flex-center'>
                            <SelectedEntryIcon size={16} />
                        </Box>
                        <Stack gap='025' flex='1' minW='0'>
                            <Text as='p' size='md' weight='medium' tone='primary' truncate title={selectedEntry.name}>
                                {selectedEntry.name}
                            </Text>
                            <Text as='p' size='sm' tone='muted' truncate className='cluster-remote-explorer-detail-path' title={selectedEntry.path}>
                                {selectedEntry.path}
                            </Text>
                        </Stack>
                    </Row>

                    <Stack gap='075' className='cluster-remote-explorer-detail-expanded'>
                        <Box display='flex' gap='05' className='cluster-remote-explorer-detail-actions'>
                            <Button
                                variant='outline'
                                intent='white'
                                size='sm'
                                onClick={handlePathCopy}
                            >
                                Copy path
                            </Button>
                            {isDownloadableEntry(selectedEntry) && (
                                <Button
                                    variant='outline'
                                    intent='white'
                                    size='sm'
                                    leftIcon={<Download size={14} />}
                                    isLoading={isDownloading}
                                    onClick={handleDownload}
                                >
                                    Download
                                </Button>
                            )}
                            {isMsgpackDecodable(selectedEntry, target) && (
                                <Button
                                    variant='outline'
                                    intent='white'
                                    size='sm'
                                    leftIcon={<FileJson size={14} />}
                                    isLoading={isMsgpackDecoding}
                                    onClick={handleDecodeMsgpack}
                                >
                                    {msgpackDecoded ? 'Re-decode MsgPack' : 'Decode MsgPack'}
                                </Button>
                            )}
                        </Box>
                        {detailContent}
                    </Stack>
                </Box>
            )}
        </Box>
    );
};

export default ClusterRemoteExplorerContent;
