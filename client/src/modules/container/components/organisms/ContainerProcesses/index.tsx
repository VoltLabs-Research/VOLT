import { Activity } from 'lucide-react';
import { useContainerProcessesQuery } from '../../../hooks/queries';
import useAccessDenied from '@/shared/presentation/hooks/use-access-denied';
import Container from '@/shared/presentation/components/Container';
import Button from '@/shared/presentation/components/Button';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Title from '@/shared/presentation/components/Title';
import RefreshButton from '@/shared/presentation/components/RefreshButton';
import AccessDenied from '@/shared/presentation/components/AccessDenied';
import Table, { type Column } from '@/shared/presentation/components/Table';
import './ContainerProcesses.css';

interface ContainerProcessesProps {
    containerId: string;
};

interface ProcessInfo {
    PID: string;
    Program: string;
    Threads: string;
    User: string;
    MemB: string;
    Cpu: string;
    Command: string;
};

const formatMemory = (kbStr: string): string => {
    const kb = parseInt(kbStr, 10);
    if(isNaN(kb)) return kbStr;
    if(kb > 1024 * 1024) return `${(kb / 1024 / 1024).toFixed(1)}G`;
    if(kb > 1024) return `${(kb / 1024).toFixed(0)}M`;
    return `${kb}K`;
};

const mapProcess = (p: string[]): ProcessInfo => ({
    PID: p[0],
    Program: p[1],
    Threads: p[2],
    User: p[3],
    MemB: formatMemory(p[4]),
    Cpu: p[5],
    Command: p.slice(6).join(' ')
});

const COLUMNS: Column<ProcessInfo>[] = [
    { key: 'PID', header: 'PID', cellClassName: 'font-family-mono' },
    { key: 'Program', header: 'Program', cellClassName: 'font-weight-5 color-success' },
    { key: 'Command', header: 'Command', cellClassName: 'font-family-mono color-muted container-processes-command-cell text-truncate' },
    { key: 'Threads', header: 'Threads', cellClassName: 'font-family-mono' },
    { key: 'User', header: 'User' },
    { key: 'MemB', header: 'MemB', cellClassName: 'font-family-mono' },
    { key: 'Cpu', header: 'Cpu%', cellClassName: 'font-family-mono', render: (row) => `${row.Cpu}%` }
];

const ContainerProcesses = ({ containerId }: ContainerProcessesProps) => {
    const { accessDenied, accessDeniedMessage, checkRBACError } = useAccessDenied();

    const { data: processes = [], isLoading, isError, error, refetch } = useContainerProcessesQuery(containerId, {
        enabled: !!containerId,
        refetchInterval: 3000
    });

    if(isError){
        checkRBACError(error);
    }

    const mappedProcesses = processes.map(mapProcess);

    if(accessDenied){
        return (
            <Container className='d-flex column flex-center h-max gap-1 p-2'>
                <AccessDenied description={accessDeniedMessage} showBack={false} />
            </Container>
        );
    }

    if(isError && mappedProcesses.length === 0){
        const errorMessage = error instanceof Error ? error.message : 'Failed to fetch processes';
        return (
            <Container className='d-flex column flex-center h-max gap-1 p-2 text-center color-muted'>
                <Activity size={48} />
                <Paragraph>{errorMessage}</Paragraph>
                <Button variant='ghost' intent='neutral' size='sm' onClick={() => refetch()}>Retry</Button>
            </Container>
        );
    }

    return (
        <Container className='d-flex h-max column overflow-hidden container-processes-container'>
            <Container className='d-flex content-between items-center container-processes-header p-1'>
                <Title className='font-size-3'>Running Processes</Title>
                <RefreshButton label='Refresh' onClick={() => refetch()} />
            </Container>
            <Container className='flex-1 overflow-auto'>
                <Table
                    columns={COLUMNS}
                    data={mappedProcesses}
                    getRowKey={(row) => row.PID}
                    isLoading={isLoading && mappedProcesses.length === 0}
                    skeletonRows={8}
                />
            </Container>
        </Container>
    );
};

export default ContainerProcesses;
