import { useContainerProcessesQuery } from '../../hooks/queries';
import { useContainerHeaderActions } from '../../hooks/use-container-details-context';
import { useMemo } from 'react';
import useAccessDenied from '@/shared/ui/hooks/use-access-denied';
import RecoveryState, { RecoveryStateTone } from '@/shared/ui/components/RecoveryState';
import RefreshButton from '@/shared/ui/components/RefreshButton';
import { Skeleton, Table } from '@heroui/react';

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

interface ProcessColumn {
    key: keyof ProcessInfo;
    header: string;
    cellClassName?: string;
    render?: (row: ProcessInfo) => string;
}

const SKELETON_ROW_COUNT = 8;
const SKELETON_ROW_KEYS = Array.from({ length: SKELETON_ROW_COUNT }, (_, index) => `skeleton-${index}`);

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

const COLUMNS: ProcessColumn[] = [
    {
        key: 'PID',
        header: 'PID',
        cellClassName: 'lining-nums tabular-nums'
    },
    {
        key: 'Program',
        header: 'Program',
        cellClassName: 'font-medium text-muted'
    },
    {
        key: 'Command',
        header: 'Command',
        cellClassName: 'max-w-[320px] truncate text-muted max-[768px]:max-w-none max-[768px]:whitespace-normal max-[768px]:[overflow-wrap:anywhere]'
    },
    {
        key: 'Threads',
        header: 'Threads',
        cellClassName: 'lining-nums tabular-nums'
    },
    {
        key: 'User',
        header: 'User'
    },
    {
        key: 'MemB',
        header: 'Memory',
        cellClassName: 'lining-nums tabular-nums'
    },
    {
        key: 'Cpu',
        header: 'CPU',
        cellClassName: 'lining-nums tabular-nums',
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

    const isSkeleton = isLoading && mappedProcesses.length === 0;

    return (
        <div className='flex h-full min-h-0 w-full flex-col animate-in fade-in-0 slide-in-from-bottom-[10px] duration-300 ease-out motion-reduce:animate-none'>
            <Table>
                <Table.ScrollContainer>
                    <Table.Content aria-label='Running processes'>
                        <Table.Header>
                            {COLUMNS.map((column, index) => (
                                <Table.Column key={column.key} id={column.key} isRowHeader={index === 0}>
                                    {column.header}
                                </Table.Column>
                            ))}
                        </Table.Header>
                        <Table.Body>
                            {isSkeleton
                                ? SKELETON_ROW_KEYS.map((skeletonKey) => (
                                    <Table.Row key={skeletonKey} id={skeletonKey}>
                                        {COLUMNS.map((column) => (
                                            <Table.Cell key={column.key}>
                                                <Skeleton animationType='pulse' className='h-3 w-[70%] rounded-md' />
                                            </Table.Cell>
                                        ))}
                                    </Table.Row>
                                ))
                                : mappedProcesses.map((row) => (
                                    <Table.Row key={row.PID} id={row.PID}>
                                        {COLUMNS.map((column) => (
                                            <Table.Cell key={column.key} className={column.cellClassName}>
                                                {column.render ? column.render(row) : row[column.key]}
                                            </Table.Cell>
                                        ))}
                                    </Table.Row>
                                ))}
                        </Table.Body>
                    </Table.Content>
                </Table.ScrollContainer>
            </Table>
        </div>
    );
};

export default ContainerProcesses;
