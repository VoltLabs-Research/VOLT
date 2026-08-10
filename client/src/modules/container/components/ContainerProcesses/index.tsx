import { useContainerProcessesQuery } from '../../hooks/queries';
import { useContainerHeaderActions } from '../../hooks/use-container-details-context';
import { useMemo } from 'react';
import './ContainerProcesses.css';
import useAccessDenied from '@/shared/ui/hooks/use-access-denied';
import RecoveryState, { RecoveryStateTone } from '@/shared/ui/components/RecoveryState';
import RefreshButton from '@/shared/ui/components/RefreshButton';
import { Table } from '@voltstack/bravais';
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
        cellClassName: 'font-medium text-muted'
    },
    {
        key: 'Command',
        header: 'Command',
        cellClassName: 'container-processes-command-cell truncate'
    },
    {
        key: 'Threads',
        header: 'Threads',
        cellClassName: 'container-processes-numeric'
    },
    {
        key: 'User',
        header: 'User'
    },
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
            <div className='flex flex-col gap-4 p-8 h-full items-center justify-center'>
                <RecoveryState
                    title='Access denied'
                    description={accessDeniedMessage ?? 'You do not have permission to view running processes.'}
                    tone={RecoveryStateTone.AccessDenied}
                    className='w-full'
                />
            </div>
        );
    }

    if(isError && mappedProcesses.length === 0){
        return (
            <div className='flex flex-col gap-4 p-8 h-full text-center items-center justify-center text-muted'>
                <RecoveryState
                    title='Unable to load running processes'
                    description={error?.message ?? 'Failed to fetch processes'}
                    tone={RecoveryStateTone.Error}
                    onRetry={() => {
                        refetch().catch(() => undefined);
                    }}
                    className='w-full'
                />
            </div>
        );
    }

    return (
        <div className='flex flex-col container-processes-container'>
            <Table
                columns={COLUMNS}
                data={mappedProcesses}
                getRowKey={(row) => row.PID}
                isLoading={isLoading && mappedProcesses.length === 0}
                skeletonRows={8}
            />
        </div>
    );
};

export default ContainerProcesses;
