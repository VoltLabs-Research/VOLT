import { TeamClusterRemoteAccessTarget, TeamClusterRemoteExplorerContentType, TeamClusterRemoteExplorerEntryType } from '@/modules/cluster/api/entities/team-cluster-remote-access';
import ClusterMongoDocumentViewer from '@/modules/cluster/components/molecules/ClusterMongoDocumentViewer';
import JsonTree from '@/modules/plugin/components/plugin/atoms/JsonTree';
import { useRemoteExplorer } from '@/shared/api/remote-explorer';
import { triggerBrowserDownload } from '@/shared/utils/file';
import { showPromise } from '@/shared/presentation/hooks/toast';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import FileExplorer from '@/shared/presentation/components/FileExplorer';
import FileExplorerRow from '@/shared/presentation/components/FileExplorer/FileExplorerRow';
import Paragraph from '@/shared/presentation/components/Paragraph';
import RefreshButton from '@/shared/presentation/components/RefreshButton';
import Title from '@/shared/presentation/components/Title';
import { decode } from '@msgpack/msgpack';
import { Database, Download, FileJson, FolderOpen, HardDrive, Package } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import './ClusterRemoteExplorerContent.css';
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

    const selectedEntry = useMemo(() => {
        return entries.find((entry) => toExplorerPath(entry.path) === explorerState.selectedPath) ?? null;
    }, [entries, explorerState.selectedPath]);

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

        await navigator.clipboard.writeText(selectedEntry.path);
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
        <Container className='d-flex items-center gap-1 flex-1'>
            <Button
                variant='ghost'
                intent='neutral'
                size='sm'
                onClick={explorerState.goUp}
                disabled={explorerState.isAtRoot}
            >
                Up
            </Button>
            <Paragraph className='font-size-2 color-secondary cluster-remote-explorer-path'>
                {explorerState.cwd}
            </Paragraph>
        </Container>
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
                <Container className='cluster-remote-explorer-empty d-flex items-center content-center'>
                    <Paragraph className='font-size-2 color-secondary'>Loading resource details...</Paragraph>
                </Container>
            );
        }

        if (nodeError) {
            return (
                <Container className='cluster-remote-explorer-empty d-flex items-center content-center'>
                    <Paragraph className='font-size-2 color-secondary'>{nodeError}</Paragraph>
                </Container>
            );
        }

        if (!selectedEntry || !node) {
            return (
                <Container className='cluster-remote-explorer-empty d-flex items-center content-center'>
                    <Paragraph className='font-size-2 color-secondary'>Select an entry to inspect its details.</Paragraph>
                </Container>
            );
        }

        if (msgpackError) {
            return (
                <Container className='cluster-remote-explorer-empty d-flex items-center content-center'>
                    <Paragraph className='font-size-2 color-secondary'>{msgpackError}</Paragraph>
                </Container>
            );
        }

        if (msgpackDecoded) {
            return (
                <Container className='cluster-remote-explorer-detail-body p-1 radius-md overflow-auto flex-1'>
                    <JsonTree data={msgpackDecoded} />
                </Container>
            );
        }

        if (node.contentType === TeamClusterRemoteExplorerContentType.MongoDocuments) {
            return <ClusterMongoDocumentViewer documents={node.mongoDocuments} />;
        }

        if (node.contentType === TeamClusterRemoteExplorerContentType.Text) {
            return (
                <Container className='cluster-remote-explorer-detail-body p-1 radius-md overflow-auto flex-1'>
                    <pre className='cluster-remote-explorer-detail-pre'>{node.textContent}</pre>
                </Container>
            );
        }

        return (
            <Container className='cluster-remote-explorer-empty d-flex items-center content-center'>
                <Paragraph className='font-size-2 color-secondary'>This entry does not expose a preview.</Paragraph>
            </Container>
        );
    }, [isNodeLoading, nodeError, node, selectedEntry, msgpackDecoded, msgpackError]);

    return (
        <Container className='cluster-remote-explorer-layout'>
            <Container className='cluster-remote-explorer-panel radius-md overflow-hidden'>
                <FileExplorer
                    headerLeft={headerLeft}
                    headerRight={headerRight}
                    columns={columns}
                    isLoading={isEntriesLoading}
                    isEmpty={!entriesError && entries.length === 0}
                    emptyMessage='No entries found'
                    error={entriesError}
                    onRetry={() => {
                        loadEntries(true);
                    }}
                    isRetrying={isEntriesRefreshing}
                >
                    {entries.map(renderEntryRow)}
                </FileExplorer>
            </Container>

            <Container className='cluster-remote-explorer-detail cluster-remote-explorer-panel radius-md p-1 d-flex column gap-1'>
                <Container className='cluster-remote-explorer-detail-header d-flex items-center gap-1'>
                    <Container className='d-flex column gap-025 flex-1'>
                        <Title className='font-size-3 font-weight-6 color-primary'>Details</Title>
                        <Paragraph className='font-size-2 color-secondary cluster-remote-explorer-detail-path' title={selectedEntry?.path}>
                            {selectedEntry
                                ? selectedEntry.path
                                : 'Select a collection, key or object to inspect its contents.'}
                        </Paragraph>
                    </Container>
                    {selectedEntry && (
                        <Button
                            variant='outline'
                            intent='white'
                            size='sm'
                            onClick={handlePathCopy}
                        >
                            Copy path
                        </Button>
                    )}
                    {selectedEntry && isDownloadableEntry(selectedEntry) && (
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
                    {selectedEntry && isMsgpackDecodable(selectedEntry, target) && (
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
                </Container>
                {detailContent}
            </Container>
        </Container>
    );
};

export default ClusterRemoteExplorerContent;
