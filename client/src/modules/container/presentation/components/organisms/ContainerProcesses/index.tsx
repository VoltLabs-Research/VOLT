import { useState, useEffect, useCallback } from 'react';
import { Activity } from 'lucide-react';
import useContainerUseCases from '../../../hooks/use-container-repository';
import useAccessDenied from '@/shared/presentation/hooks/use-access-denied';
import Container from '@/shared/presentation/components/Container';
import Button from '@/shared/presentation/components/Button';
import Paragraph from '@/shared/presentation/components/Paragraph';
import Title from '@/shared/presentation/components/Title';
import RefreshButton from '@/shared/presentation/components/RefreshButton';
import AccessDenied from '@/shared/presentation/components/AccessDenied';
import Table, { type Column } from '@/shared/presentation/components/Table';
import type { RawContainerProcess } from '@/modules/container/domain/entities';
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

const mapProcess = (p: RawContainerProcess): ProcessInfo => ({
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
    const [processes, setProcesses] = useState<RawContainerProcess[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { accessDenied, accessDeniedMessage, checkRBACError } = useAccessDenied();

    const { containerRepository } = useContainerUseCases();

    const handleFetch = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await containerRepository.getProcesses(containerId);
            setProcesses(result);
        } catch (e: any) {
            if(checkRBACError(e)) return;
            setError(e?.message || 'Failed to fetch processes');
        } finally {
            setIsLoading(false);
        }
    }, [containerId, containerRepository, checkRBACError]);

    useEffect(() => {
        handleFetch();
        const interval = setInterval(handleFetch, 3000);
        return () => clearInterval(interval);
    }, [handleFetch]);

    const mappedProcesses = processes.map(mapProcess);

    if(accessDenied){
        return (
            <Container className='d-flex column flex-center h-max gap-1 p-2'>
                <AccessDenied description={accessDeniedMessage} showBack={false} />
            </Container>
        );
    }

    if(error && mappedProcesses.length === 0){
        return (
            <Container className='d-flex column flex-center h-max gap-1 p-2 text-center color-muted'>
                <Activity size={48} />
                <Paragraph>{error}</Paragraph>
                <Button variant='ghost' intent='neutral' size='sm' onClick={handleFetch}>Retry</Button>
            </Container>
        );
    }

    return (
        <Container className='d-flex h-max column overflow-hidden container-processes-container'>
            <Container className='d-flex content-between items-center container-processes-header p-1'>
                <Title className='font-size-3'>Running Processes</Title>
                <RefreshButton label='Refresh' onClick={handleFetch} />
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
