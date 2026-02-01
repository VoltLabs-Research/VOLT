import { useMemo } from 'react';
import { ChevronDown, RefreshCw, Download } from 'lucide-react';
import { Skeleton } from '@mui/material';
import type { ClusterMetrics } from '@/modules/cluster/domain/entities';
import { transformClustersToRows, type ServerRow } from '@/modules/cluster/presentation/utilities/transform-cluster-row';
import Container from '@/shared/presentation/components/Container';
import Button from '@/shared/presentation/components/Button';
import Tooltip from '@/shared/presentation/components/Tooltip';
import Title from '@/shared/presentation/components/Title';
import Paragraph from '@/shared/presentation/components/Paragraph';
import './ServerTable.css';

interface ServerTableProps {
    clusters: ClusterMetrics[];
    selectedClusterId: string;
};

const TABLE_HEADERS = ['Server ID', 'Status', 'CPU', 'Memory', 'Disk', 'Network', 'Computed Analyzes', 'Uptime'];

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

const LoadingSkeleton = () => (
    <tr>
        <td colSpan={8}>
            <Container className='d-flex column gap-1 p-2-5'>
                <Container className='d-flex items-center gap-1'>
                    <Skeleton variant='text' width={100} height={20} />
                    <Skeleton variant='rectangular' width={60} height={24} sx={{ borderRadius: '4px' }} />
                    <Skeleton variant='rectangular' width={80} height={24} sx={{ borderRadius: '12px' }} />
                    <Skeleton variant='text' width={60} height={20} />
                    <Skeleton variant='text' width={60} height={20} />
                    <Skeleton variant='text' width={60} height={20} />
                    <Skeleton variant='text' width={80} height={20} />
                    <Skeleton variant='text' width={60} height={20} />
                </Container>
            </Container>
        </td>
    </tr>
);

const ServerTableRow = ({ server, isSelected }: { server: ServerRow; isSelected: boolean }) => (
    <tr
        style={{
            cursor: 'pointer',
            background: isSelected ? 'var(--bg-tertiary)' : undefined
        }}
    >
        <td>
            <Container className='d-flex items-center gap-05'>
                <Container className='server-table-status-dot' />
                <Paragraph className='server-table-id font-size-2 color-primary'>
                    {server.id}
                </Paragraph>
            </Container>
        </td>
        <td>
            <Paragraph className={`server-table-status ${server.statusClass} font-size-1 font-weight-5`}>
                {server.status}
            </Paragraph>
        </td>
        <td>
            <Container className='d-flex items-center gap-05'>
                <MetricBars percentage={server.cpu} />
                <Paragraph className='server-table-metric-value font-size-1 color-muted-foreground'>
                    {server.cpu}%
                </Paragraph>
            </Container>
        </td>
        <td>
            <Container className='d-flex items-center gap-05'>
                <MetricBars percentage={server.memory} />
                <Paragraph className='server-table-metric-value font-size-1 color-muted-foreground'>
                    {server.memory}%
                </Paragraph>
            </Container>
        </td>
        <td>
            <Container className='d-flex items-center gap-05'>
                <MetricBars percentage={server.diskUsagePercent} />
                <Paragraph className='server-table-metric-value font-size-1 color-muted-foreground'>
                    {server.diskFree.toFixed(1)}GB Available
                </Paragraph>
            </Container>
        </td>
        <td>
            <Paragraph className='server-table-network font-size-2'>
                {server.network}
            </Paragraph>
        </td>
        <td>
            <Paragraph className='server-table-network font-size-2'>
                {server.analysisCount}
            </Paragraph>
        </td>
        <td>
            <Paragraph className='server-table-uptime font-size-2 font-weight-5'>
                {server.uptime}
            </Paragraph>
        </td>
    </tr>
);

const ServerTable = ({ clusters, selectedClusterId }: ServerTableProps) => {
    const isLoading = !clusters?.length;
    const rows = useMemo(() => transformClustersToRows(clusters ?? []), [clusters]);

    return (
        <Container className='server-table-container p-1-5'>
            <Container className='d-flex items-center content-between server-table-header mb-1-5'>
                <Container className='d-flex items-center gap-075'>
                    <Container className='server-table-title-bar' />
                    <Title className='font-size-3 server-table-title font-weight-6 color-primary'>
                        Server Summary
                    </Title>
                </Container>
                <Container className='d-flex items-center gap-05'>
                    <Button
                        variant='ghost'
                        intent='neutral'
                        size='sm'
                        rightIcon={<ChevronDown className='server-table-icon-sm color-muted' />}
                    >
                        Status
                    </Button>
                    <Button
                        variant='ghost'
                        intent='neutral'
                        size='sm'
                        rightIcon={<ChevronDown className='server-table-icon-sm color-muted' />}
                    >
                        Sort
                    </Button>
                    <Tooltip content='Refresh' placement='bottom'>
                        <Button variant='ghost' intent='neutral' iconOnly size='sm'>
                            <RefreshCw className='server-table-icon color-secondary' />
                        </Button>
                    </Tooltip>
                    <Tooltip content='Download Report' placement='bottom'>
                        <Button variant='ghost' intent='neutral' iconOnly size='sm'>
                            <Download className='server-table-icon color-secondary' />
                        </Button>
                    </Tooltip>
                </Container>
            </Container>

            <Container className='server-table-wrapper'>
                <table className='server-table w-max'>
                    <thead>
                        <tr>
                            {TABLE_HEADERS.map((header) => (
                                <th key={header}>{header}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <LoadingSkeleton />
                        ) : (
                            rows.map((server) => (
                                <ServerTableRow
                                    key={server.id}
                                    server={server}
                                    isSelected={server.id === selectedClusterId}
                                />
                            ))
                        )}
                    </tbody>
                </table>
            </Container>
        </Container>
    );
};

export default ServerTable;
