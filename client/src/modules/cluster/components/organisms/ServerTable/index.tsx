import { transformClustersToRows } from '@/modules/cluster/utilities/transform-cluster-row';
import { formatClusterTimestamp } from '@/modules/cluster/utilities/format-cluster-timestamp';
import { getTeamClusterStatusLabel, getTeamClusterStatusVariant } from '@/modules/cluster/utilities/team-cluster-status';
import MetricBars from '@/modules/cluster/components/organisms/MetricBars';
import ContextMenuPopover from '@/shared/presentation/components/ContextMenuPopover';
import './ServerTable.css';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import Paragraph from '@/shared/presentation/components/Paragraph';
import RefreshButton from '@/shared/presentation/components/RefreshButton';
import StatusBadge from '@/shared/presentation/components/StatusBadge';
import Title from '@/shared/presentation/components/Title';
import Tooltip from '@/shared/presentation/components/Tooltip';
import { Skeleton } from '@mui/material';
import { useMemo, useCallback } from 'react';
import { ChevronDown, Download, KeyRound, Trash2 } from 'lucide-react';
import type { ClusterMetrics } from '@/modules/cluster/api/entities/cluster-metrics';
import type { TeamCluster } from '@/modules/cluster/api/entities/team-cluster';
import type { ServerRow } from '@/modules/cluster/utilities/transform-cluster-row';
import type { MenuOption } from '@/shared/presentation/types/menu';

interface ServerTableProps {
    clusters: TeamCluster[];
    metricsByClusterId: Record<string, ClusterMetrics>;
    selectedClusterId: string;
    onSelectCluster: (clusterId: string) => void;
    onRevealCredentials: (clusterId: string) => void;
    onDeleteCluster: (clusterId: string) => void;
};

interface ColumnDef {
    key: string;
    header: string;
    render: (row: ServerRow) => React.ReactNode;
};

const COLUMNS: ColumnDef[] = [
    {
        key: 'id',
        header: 'Cluster',
        render: (row) => (
            <Container className='d-flex column gap-025'>
                <Container className='d-flex items-center gap-05'>
                    <Container className='server-table-status-dot' />
                    <Paragraph className='font-size-2 color-primary'>{row.name}</Paragraph>
                </Container>
                <Paragraph className='font-size-1 color-muted font-family-mono'>{row.id}</Paragraph>
            </Container>
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
            <Paragraph className={`server-table-status ${row.statusClass} font-size-1 font-weight-5`}>
                {row.status}
            </Paragraph>
        )
    },
    {
        key: 'installedVersion',
        header: 'Version',
        render: (row) => (
            <Paragraph className='font-size-2 color-secondary'>{row.installedVersion ?? '--'}</Paragraph>
        )
    },
    {
        key: 'lastHeartbeatAt',
        header: 'Last Heartbeat',
        render: (row) => (
            <Paragraph className='font-size-1 color-secondary'>{formatClusterTimestamp(row.lastHeartbeatAt)}</Paragraph>
        )
    },
    {
        key: 'daemonPort',
        header: 'Daemon Port',
        render: (row) => (
            <Paragraph className='font-size-2 color-secondary font-family-mono'>{row.daemonPort ?? '--'}</Paragraph>
        )
    },
    {
        key: 'cpu',
        header: 'CPU',
        render: (row) => (
            <Container className='d-flex items-center gap-05'>
                <MetricBars percentage={row.cpu} />
                <Paragraph className='font-size-1 color-muted'>{row.cpu}%</Paragraph>
            </Container>
        )
    },
    {
        key: 'memory',
        header: 'Memory',
        render: (row) => (
            <Container className='d-flex items-center gap-05'>
                <MetricBars percentage={row.memory} />
                <Paragraph className='font-size-1 color-muted'>{row.memory}%</Paragraph>
            </Container>
        )
    },
    {
        key: 'disk',
        header: 'Disk',
        render: (row) => (
            <Container className='d-flex items-center gap-05'>
                <MetricBars percentage={row.diskUsagePercent} />
                <Paragraph className='font-size-1 color-muted'>{row.diskFree.toFixed(1)}GB Available</Paragraph>
            </Container>
        )
    },
    {
        key: 'network',
        header: 'Network',
        render: (row) => <Paragraph className='font-size-2 color-secondary'>{row.network}</Paragraph>
    },
    {
        key: 'analysisCount',
        header: 'Computed Analyzes',
        render: (row) => <Paragraph className='font-size-2 color-secondary'>{row.analysisCount}</Paragraph>
    },
    {
        key: 'uptime',
        header: 'Uptime',
        render: (row) => <Paragraph className='font-size-2 font-weight-5 color-secondary'>{row.uptime}</Paragraph>
    }
];

const SKELETON_COUNT = 3;

const ServerTable = ({
    clusters,
    metricsByClusterId,
    selectedClusterId,
    onSelectCluster,
    onRevealCredentials,
    onDeleteCluster
}: ServerTableProps) => {
    const isLoading = !clusters?.length;

    const rows = useMemo(() => {
        return transformClustersToRows(clusters.map((cluster) => ({
            teamCluster: cluster,
            metrics: metricsByClusterId[cluster._id] ?? null
        })));
    }, [clusters, metricsByClusterId]);

    const getMenuOptions = useCallback((row: ServerRow): MenuOption[] => [
        {
            label: 'Reveal credentials',
            icon: KeyRound,
            onClick: () => onRevealCredentials(row.id)
        },
        {
            label: 'Delete cluster',
            icon: Trash2,
            destructive: true,
            onClick: () => onDeleteCluster(row.id)
        }
    ], [onRevealCredentials, onDeleteCluster]);

    const renderSkeletonRows = () =>
        Array.from({ length: SKELETON_COUNT }).map((_, i) => (
            <tr key={`skeleton-${i}`}>
                {COLUMNS.map((col) => (
                    <td key={col.key}>
                        <Skeleton variant='text' width='70%' height={20} animation='wave' />
                    </td>
                ))}
            </tr>
        ));

    const renderRow = (row: ServerRow) => {
        const rowElement = (
            <tr
                key={row.id}
                className={row.id === selectedClusterId ? 'clickable selected' : 'clickable'}
                onClick={() => onSelectCluster(row.id)}
            >
                {COLUMNS.map((col) => (
                    <td key={col.key}>{col.render(row)}</td>
                ))}
            </tr>
        );

        return (
            <ContextMenuPopover
                key={row.id}
                id={`cluster-row-menu-${row.id}`}
                trigger={rowElement}
                options={getMenuOptions(row)}
            />
        );
    };

    return (
        <Container className='server-table-container p-1-5'>
            <Container className='d-flex items-center content-between server-table-header mb-1-5'>
                <Container className='d-flex items-center gap-075'>
                    <Container className='server-table-title-bar' />
                    <Title className='font-size-3 font-weight-6 color-primary'>Clusters</Title>
                </Container>
                <Container className='d-flex items-center gap-05'>
                    <Button variant='ghost' intent='neutral' size='sm' rightIcon={<ChevronDown size={12} />}>
                        Status
                    </Button>
                    <Button variant='ghost' intent='neutral' size='sm' rightIcon={<ChevronDown size={12} />}>
                        Sort
                    </Button>
                    <RefreshButton size='sm' />
                    <Tooltip content='Download Report' placement='bottom'>
                        <Button variant='ghost' intent='neutral' iconOnly size='sm'>
                            <Download size={16} />
                        </Button>
                    </Tooltip>
                </Container>
            </Container>

            <Container className='server-table-wrapper'>
                <table className='table'>
                    <thead>
                        <tr>
                            {COLUMNS.map((col) => (
                                <th key={col.key}>{col.header}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? renderSkeletonRows() : rows.map(renderRow)}
                    </tbody>
                </table>
            </Container>
        </Container>
    );
};

export default ServerTable;
