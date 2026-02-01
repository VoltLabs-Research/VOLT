import { useMemo } from 'react';
import { ChevronDown, Download } from 'lucide-react';
import type { ClusterMetrics } from '@/modules/cluster/domain/entities';
import { transformClustersToRows, type ServerRow } from '@/modules/cluster/presentation/utilities/transform-cluster-row';
import Container from '@/shared/presentation/components/Container';
import Button from '@/shared/presentation/components/Button';
import Tooltip from '@/shared/presentation/components/Tooltip';
import Title from '@/shared/presentation/components/Title';
import Paragraph from '@/shared/presentation/components/Paragraph';
import RefreshButton from '@/shared/presentation/components/RefreshButton';
import Table, { type Column } from '@/shared/presentation/components/Table';
import './ServerTable.css';

interface ServerTableProps {
    clusters: ClusterMetrics[];
    selectedClusterId: string;
};

const MetricBars = ({ percentage }: { percentage: number }) => {
    const activeBars = Math.floor(percentage / 20);
    
    return (
        <Container className='d-flex gap-01'>
            {[0, 1, 2, 3, 4].map((i) => (
                <Container
                    key={i}
                    className={`server-table-bar ${i < activeBars ? 'server-table-bar-active' : ''}`}
                />
            ))}
        </Container>
    );
};

const COLUMNS: Column<ServerRow>[] = [
    {
        key: 'id',
        header: 'Server ID',
        render: (row) => (
            <Container className='d-flex items-center gap-05'>
                <Container className='server-table-status-dot' />
                <Paragraph className='font-size-2 color-primary font-family-mono'>{row.id}</Paragraph>
            </Container>
        )
    },
    {
        key: 'status',
        header: 'Status',
        render: (row) => (
            <Paragraph className={`server-table-status ${row.statusClass} font-size-1 font-weight-5`}>
                {row.status}
            </Paragraph>
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

const ServerTable = ({ clusters, selectedClusterId }: ServerTableProps) => {
    const isLoading = !clusters?.length;
    const rows = useMemo(() => transformClustersToRows(clusters ?? []), [clusters]);

    return (
        <Container className='server-table-container p-1-5'>
            <Container className='d-flex items-center content-between server-table-header mb-1-5'>
                <Container className='d-flex items-center gap-075'>
                    <Container className='server-table-title-bar' />
                    <Title className='font-size-3 font-weight-6 color-primary'>Server Summary</Title>
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
                <Table
                    columns={COLUMNS}
                    data={rows}
                    getRowKey={(row) => row.id}
                    isLoading={isLoading}
                    skeletonRows={3}
                    rowClassName={(row) => row.id === selectedClusterId ? 'selected' : ''}
                />
            </Container>
        </Container>
    );
};

export default ServerTable;
