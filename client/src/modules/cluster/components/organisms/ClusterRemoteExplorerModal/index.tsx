import { TeamClusterRemoteAccessTarget, TeamClusterRemoteExplorerContentType, TeamClusterRemoteExplorerEntryType } from '@/modules/cluster/api/entities/team-cluster-remote-access';
import ClusterMongoDocumentViewer from '@/modules/cluster/components/molecules/ClusterMongoDocumentViewer';
import { getTeamClusterRemoteAccessLabel } from '@/modules/cluster/utilities/team-cluster-remote-access';
import { useRemoteExplorer } from '@/shared/api/remote-explorer';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import FileExplorer from '@/shared/presentation/components/FileExplorer';
import FileExplorerRow from '@/shared/presentation/components/FileExplorer/FileExplorerRow';
import Modal from '@/shared/presentation/components/Modal';
import Paragraph from '@/shared/presentation/components/Paragraph';
import RefreshButton from '@/shared/presentation/components/RefreshButton';
import Title from '@/shared/presentation/components/Title';
import { Database, FolderOpen, HardDrive, Package } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import './ClusterRemoteExplorerModal.css';
import type { TeamClusterRemoteAccessSession, TeamClusterRemoteExplorerEntry, TeamClusterRemoteExplorerNode } from '@/modules/cluster/api/entities/team-cluster-remote-access';
import type { TeamCluster } from '@/modules/cluster/api/entities/team-cluster';

export const CLUSTER_REMOTE_EXPLORER_MODAL_ID = 'cluster-remote-explorer-modal';

interface ClusterRemoteExplorerModalProps {
    teamCluster: TeamCluster | null;
    target: TeamClusterRemoteAccessTarget | null;
    session: TeamClusterRemoteAccessSession | null;
    onClose: () => void;
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
};

type LucideIconComponent = typeof Database;

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

const ClusterRemoteExplorerModal = ({
    teamCluster,
    target,
    session,
    onClose,
    listEntries,
    getNode
}: ClusterRemoteExplorerModalProps) => {
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

    useEffect(() => {
        remoteExplorer.navigateTo('/');
    }, [session?.sessionId, target]);

    const loadEntries = async (refresh = false) => {
        if (!teamCluster || !session || !target) {
            return;
        }

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
        if (!teamCluster || !session || !target) {
            return;
        }

        void loadEntries();
    }, [teamCluster?._id, session?.sessionId, target, explorerState.path]);

    const selectedEntry = useMemo(() => {
        return entries.find((entry) => toExplorerPath(entry.path) === explorerState.selectedPath) ?? null;
    }, [entries, explorerState.selectedPath]);

    useEffect(() => {
        if (!teamCluster || !session || !target || !selectedEntry || isNavigableEntry(selectedEntry)) {
            setNode(null);
            setNodeError(null);
            return;
        }

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
    }, [teamCluster?._id, session?.sessionId, target, selectedEntry?.path]);

    const handleEntryClick = (entry: TeamClusterRemoteExplorerEntry) => {
        explorerState.setSelectedPath(toExplorerPath(entry.path));
    };

    const handleEntryDoubleClick = (entry: TeamClusterRemoteExplorerEntry) => {
        if (!isNavigableEntry(entry)) {
            explorerState.setSelectedPath(toExplorerPath(entry.path));
            return;
        }

        explorerState.navigateTo(toExplorerPath(entry.path));
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
                void loadEntries(true);
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
    }, [isNodeLoading, nodeError, node, selectedEntry]);

    return (
        <Modal
            id={CLUSTER_REMOTE_EXPLORER_MODAL_ID}
            title={`${target ? getTeamClusterRemoteAccessLabel(target) : 'Remote Explorer'}${teamCluster ? ` · ${teamCluster.name}` : ''}`}
            description='Shared explorer UI for cluster resources.'
            className='cluster-remote-explorer-modal'
            width='min(96vw, 1480px)'
            onClose={onClose}
        >
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
                            void loadEntries(true);
                        }}
                        isRetrying={isEntriesRefreshing}
                    >
                        {entries.map((entry) => {
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
                        })}
                    </FileExplorer>
                </Container>

                <Container className='cluster-remote-explorer-detail cluster-remote-explorer-panel radius-md p-1 d-flex column gap-1'>
                    <Container className='d-flex column gap-025'>
                        <Title className='font-size-3 font-weight-6 color-primary'>Details</Title>
                        <Paragraph className='font-size-2 color-secondary'>
                            {selectedEntry
                                ? selectedEntry.path
                                : 'Select a collection, key or object to inspect its contents.'}
                        </Paragraph>
                    </Container>
                    {detailContent}
                </Container>
            </Container>
        </Modal>
    );
};

export default ClusterRemoteExplorerModal;
