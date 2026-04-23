import { transformClustersToRows } from '@/modules/cluster/utilities/transform-cluster-row';
import { formatClusterTimestamp } from '@/modules/cluster/utilities/format-cluster-timestamp';
import { TeamClusterRemoteAccessTarget } from '@/modules/cluster/api/entities/team-cluster-remote-access';
import { getTeamClusterStatusLabel, getTeamClusterStatusVariant } from '@/modules/cluster/utilities/team-cluster-status';
import MetricBars from '@/modules/cluster/components/MetricBars';
import { ContextMenuPopover } from '@/shared/presentation/primitives';
import './ServerTable.css';
import RefreshButton from '@/shared/presentation/components/RefreshButton';
import { Box, Stack, Row, Text, Heading, Button, StatusBadge, Skeleton } from '@/shared/presentation/primitives';
import { useMemo, useCallback } from 'react';
import { Database, FolderOpen, KeyRound, MoreHorizontal, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import type { ClusterMetrics } from '@/modules/cluster/api/entities/cluster-metrics';
import type { TeamCluster } from '@/modules/cluster/api/entities/team-cluster';
import type { ServerRow } from '@/modules/cluster/utilities/transform-cluster-row';
import type { MenuOption } from '@/shared/presentation/types/menu';

interface ServerTableProps {
    clusters: TeamCluster[];
    metricsByClusterId: Record<string, ClusterMetrics>;
    isMetricsConnected?: boolean;
    selectedClusterId: string | null;
    onSelectCluster: (clusterId: string) => void;
    onRevealCredentials: (clusterId: string) => void;
    onDeleteCluster: (clusterId: string) => void;
    onRemoteAccessAction: (clusterId: string, target: TeamClusterRemoteAccessTarget) => void;
};

interface ColumnDef {
    key: string;
    header: string;
    render: (row: ServerRow) => ReactNode;
};

const renderMetricValue = (value: number | null): ReactNode => {
    if (value === null) {
        return <Text as='p' size='sm' tone='muted'>--</Text>;
    }

    return (
        <Row gap='05'>
            <MetricBars percentage={value} />
            <Text as='p' size='sm' tone='muted'>{value}%</Text>
        </Row>
    );
};

const renderDiskValue = (row: ServerRow): ReactNode => {
    if (row.diskUsagePercent === null || row.diskFree === null) {
        return <Text as='p' size='sm' tone='muted'>--</Text>;
    }

    return (
        <Row gap='05'>
            <MetricBars percentage={row.diskUsagePercent} />
            <Text as='p' size='sm' tone='muted'>{row.diskFree.toFixed(1)}GB Available</Text>
        </Row>
    );
};

const COLUMNS: ColumnDef[] = [
    {
        key: 'id',
        header: 'Cluster',
        render: (row) => (
            <Stack gap='025'>
                <Row gap='05'>
                    <Text as='p' size='md' tone='primary'>{row.name}</Text>
                </Row>
                <Text as='p' size='sm' tone='muted' className='font-family-mono'>{row.id}</Text>
            </Stack>
        )
    },
    {
        key: 'status',
        header: 'Lifecycle',
        render: (row) => (
            <StatusBadge variant={getTeamClusterStatusVariant(row.lifecycleStatus)} size='compact'>
                {getTeamClusterStatusLabel(row.lifecycleStatus)}
            </StatusBadge>
        )
    },
    {
        key: 'metricsStatus',
        header: 'Metrics',
        render: (row) => (
            <StatusBadge variant={row.statusVariant} size='compact'>
                {row.status}
            </StatusBadge>
        )
    },
    {
        key: 'installedVersion',
        header: 'Version',
        render: (row) => (
            <Text as='p' size='md' tone='secondary'>{row.installedVersion ?? '--'}</Text>
        )
    },
    {
        key: 'lastHeartbeatAt',
        header: 'Last Heartbeat',
        render: (row) => (
            <Text as='p' size='sm' tone='secondary'>{formatClusterTimestamp(row.lastHeartbeatAt)}</Text>
        )
    },
    {
        key: 'daemonPort',
        header: 'Daemon Port',
        render: (row) => (
            <Text as='p' size='md' tone='secondary' className='font-family-mono'>{row.daemonPort ?? '--'}</Text>
        )
    },
    {
        key: 'cpu',
        header: 'CPU',
        render: (row) => renderMetricValue(row.cpu)
    },
    {
        key: 'memory',
        header: 'Memory',
        render: (row) => renderMetricValue(row.memory)
    },
    {
        key: 'disk',
        header: 'Disk',
        render: (row) => renderDiskValue(row)
    },
    {
        key: 'network',
        header: 'Network',
        render: (row) => <Text as='p' size='md' tone='secondary'>{row.network}</Text>
    },
    {
        key: 'analysisCount',
        header: 'Computed Analyzes',
        render: (row) => <Text as='p' size='md' tone='secondary'>{row.analysisCount ?? '--'}</Text>
    },
    {
        key: 'uptime',
        header: 'Uptime',
        render: (row) => <Text as='p' size='md' weight='medium' tone='secondary'>{row.uptime}</Text>
    }
];

const SKELETON_COUNT = 3;

const ServerTable = ({
    clusters,
    metricsByClusterId,
    isMetricsConnected = true,
    selectedClusterId,
    onSelectCluster,
    onRevealCredentials,
    onDeleteCluster,
    onRemoteAccessAction
}: ServerTableProps) => {
    const isLoading = !clusters?.length;

    const rows = useMemo(() => {
        return transformClustersToRows(clusters.map((cluster) => ({
            teamCluster: cluster,
            metrics: metricsByClusterId[cluster._id] ?? null,
            isMetricsConnected
        })));
    }, [clusters, isMetricsConnected, metricsByClusterId]);

    const getMenuOptions = useCallback((row: ServerRow): MenuOption[] => [
        {
            label: 'Reveal credentials',
            icon: KeyRound,
            onClick: () => onRevealCredentials(row.id)
        },
        {
            label: 'Explore Mongo Documents',
            icon: Database,
            onClick: () => onRemoteAccessAction(row.id, TeamClusterRemoteAccessTarget.MongoDocuments)
        },
        {
            label: 'Explore Redis Data',
            icon: Database,
            onClick: () => onRemoteAccessAction(row.id, TeamClusterRemoteAccessTarget.RedisData)
        },
        {
            label: 'Explore MinIO',
            icon: FolderOpen,
            onClick: () => onRemoteAccessAction(row.id, TeamClusterRemoteAccessTarget.Minio)
        },
        {
            label: 'Delete cluster',
            icon: Trash2,
            destructive: true,
            onClick: () => onDeleteCluster(row.id)
        }
    ], [onDeleteCluster, onRemoteAccessAction, onRevealCredentials]);

    const renderSkeletonRows = () =>
        Array.from({ length: SKELETON_COUNT }).map((_, i) => (
            <tr key={`skeleton-${i}`}>
                {COLUMNS.map((col) => (
                    <td key={col.key}>
                        <Skeleton variant='text' width='70%' height={20} animation='wave' />
                    </td>
                ))}
                <td>
                    <Skeleton variant='circular' width={28} height={28} animation='wave' />
                </td>
            </tr>
        ));

    const renderRow = (row: ServerRow) => {
        const isSelected = row.id === selectedClusterId;
        const actionsTrigger = (
            <Button
                variant='ghost'
                intent='neutral'
                iconOnly
                size='sm'
                aria-label={`Open actions for ${row.name}`}
                title={`Open actions for ${row.name}`}
                onClick={(event) => {
                    event.stopPropagation();
                }}
            >
                <MoreHorizontal size={16} />
            </Button>
        );

        return (
            <tr
                key={row.id}
                className={`server-table-row ${isSelected ? 'selected' : ''}`}
                onClick={() => onSelectCluster(row.id)}
                onKeyDown={(event) => {
                    if (event.key !== 'Enter' && event.key !== ' ') {
                        return;
                    }

                    event.preventDefault();
                    onSelectCluster(row.id);
                }}
                tabIndex={0}
                aria-selected={isSelected}
            >
                {COLUMNS.map((col) => (
                    <td key={col.key}>{col.render(row)}</td>
                ))}
                <td className='server-table-actions-cell'>
                    <ContextMenuPopover
                        id={`cluster-row-menu-${row.id}`}
                        trigger={actionsTrigger}
                        options={getMenuOptions(row)}
                        triggerAction='click'
                    />
                </td>
            </tr>
        );
    };

    return (
        <Box p='1-5' className='server-table-container'>
            <Row justify='between' className='server-table-header mb-1-5'>
                <Row gap='075'>
                    <Box className='server-table-title-bar' />
                    <Heading level={3} size='lg' weight='bold'>Clusters</Heading>
                </Row>
                <RefreshButton size='sm' />
            </Row>

            <Box className='server-table-wrapper'>
                <table className='table' aria-label='Clusters table'>
                    <thead>
                        <tr>
                            {COLUMNS.map((col) => (
                                <th key={col.key}>{col.header}</th>
                            ))}
                            <th className='server-table-actions-header'>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? renderSkeletonRows() : rows.map(renderRow)}
                    </tbody>
                </table>
            </Box>
        </Box>
    );
};

export default ServerTable;
