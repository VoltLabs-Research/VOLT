import { useContainerProcessesQuery } from '../../hooks/queries';
import { useContainerHeaderActions } from '../../hooks/use-container-details-context';
import { useMemo } from 'react';
import './ContainerProcesses.css';
import useAccessDenied from '@/shared/presentation/hooks/use-access-denied';
import RecoveryState, { RecoveryStateTone } from '@/shared/presentation/components/RecoveryState';
import RefreshButton from '@/shared/presentation/components/RefreshButton';
import { Stack, Table } from '@voltstack/bravais';
import type { Column } from '@voltstack/bravais';

interface ContainerProcessesProps {
    containerId: string;
}

interface ProcessInfo {
    PID: string;
    Program: string;
    Threads: string;
    User: string;
    MemB: string;
    Cpu: string;
    Command: string;
}

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
    {
        key: 'PID',
        header: 'PID',
        cellClassName: 'container-processes-numeric'
    },
    {
        key: 'Program',
        header: 'Program',
        cellClassName: 'font-weight-5 color-secondary'
    },
    {
        key: 'Command',
        header: 'Command',
        cellClassName: 'container-processes-command-cell text-truncate'
    },
    {
        key: 'Threads',
        header: 'Threads',
        cellClassName: 'container-processes-numeric'
    },
    { key: 'User', header: 'User' },
    {
        key: 'MemB',
        header: 'Memory',
        cellClassName: 'container-processes-numeric'
    },
    {
        key: 'Cpu',
        header: 'CPU',
        cellClassName: 'container-processes-numeric',
        render: (row) => `${row.Cpu}%`
    }
];

const ContainerProcesses = ({ containerId }: ContainerProcessesProps) => {
    const { accessDenied, accessDeniedMessage, checkAccessDeniedError } = useAccessDenied();

    const { data: processes = [], isLoading, isError, error, refetch } = useContainerProcessesQuery(containerId, {
        enabled: !!containerId,
        refetchInterval: () => {
            return document.hidden ? false : 10000;
        },
        refetchIntervalInBackground: false,
        refetchOnWindowFocus: false,
        staleTime: 5000
    });

    const headerActions = useMemo(() => (
        <RefreshButton label='Refresh' onClick={() => refetch()} />
    ), [refetch]);

    useContainerHeaderActions(headerActions);

    if(isError){
        checkAccessDeniedError(error);
    }

    const mappedProcesses = processes.map(mapProcess);

    if(accessDenied){
        return (
            <Stack className='flex-center' height='max' gap='1' p='2'>
                <RecoveryState
                    title='Access denied'
                    description={accessDeniedMessage ?? 'You do not have permission to view running processes.'}
                    tone={RecoveryStateTone.AccessDenied}
                    className='w-max'
                />
            </Stack>
        );
    }

    if(isError && mappedProcesses.length === 0){
        const errorMessage = error instanceof Error ? error.message : 'Failed to fetch processes';
        return (
            <Stack className='flex-center color-muted' height='max' gap='1' p='2' textAlign='center'>
                <RecoveryState
                    title='Unable to load running processes'
                    description={errorMessage}
                    tone={RecoveryStateTone.Error}
                    onRetry={() => {
                        refetch().catch(() => undefined);
                    }}
                    className='w-max'
                />
            </Stack>
        );
    }

    return (
        <Stack className='container-processes-container'>
            <Table
                columns={COLUMNS}
                data={mappedProcesses}
                getRowKey={(row) => row.PID}
                isLoading={isLoading && mappedProcesses.length === 0}
                skeletonRows={8}
            />
        </Stack>
    );
};

export default ContainerProcesses;
