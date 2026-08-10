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

/**
 * `ContainerProcesses.css`, converted.
 *
 * `.container-processes-numeric` was `font-variant-numeric: tabular-nums` plus
 * `font-feature-settings: 'tnum' on, 'lnum' on`; Tailwind's `tabular-nums` and
 * `lining-nums` compose into the same two features through `--tw-numeric-*`.
 *
 * `.container-processes-command-cell` clamped the command to 320px and let it
 * wrap anywhere below 768px, which is the only reason a full `docker run …`
 * argument list does not push the table sideways.
 */
const NUMERIC_CELL_CLASS_NAMES = 'lining-nums tabular-nums';
const COMMAND_CELL_CLASS_NAMES = 'max-w-[320px] truncate text-muted max-[768px]:max-w-none max-[768px]:whitespace-normal max-[768px]:[overflow-wrap:anywhere]';

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
        cellClassName: NUMERIC_CELL_CLASS_NAMES
    },
    {
        key: 'Program',
        header: 'Program',
        cellClassName: 'font-medium text-muted'
    },
    {
        key: 'Command',
        header: 'Command',
        cellClassName: COMMAND_CELL_CLASS_NAMES
    },
    {
        key: 'Threads',
        header: 'Threads',
        cellClassName: NUMERIC_CELL_CLASS_NAMES
    },
    {
        key: 'User',
        header: 'User'
    },
    {
        key: 'MemB',
        header: 'Memory',
        cellClassName: NUMERIC_CELL_CLASS_NAMES
    },
    {
        key: 'Cpu',
        header: 'CPU',
        cellClassName: NUMERIC_CELL_CLASS_NAMES,
        render: (row) => `${row.Cpu}%`
    }
];

/**
 * The container fills its route and fades in, as `.container-processes-container`
 * did. `animate-in fade-in-0 slide-in-from-bottom-[10px] duration-300 ease-out` is
 * bravais's `animate-fade-in 0.3s ease-out` keyframe expressed through
 * `tw-animate-css`, which ships with `@heroui/styles`, and
 * `motion-reduce:animate-none` restates the sheet's own reduced-motion opt-out.
 */
const CONTAINER_CLASS_NAMES = 'flex h-full min-h-0 w-full flex-col animate-in fade-in-0 slide-in-from-bottom-[10px] duration-300 ease-out motion-reduce:animate-none';

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
        <div className={CONTAINER_CLASS_NAMES}>
            <Table>
                <Table.ScrollContainer>
                    {/*
                      * `aria-label` is required by React Aria's table and bravais's had
                      * none (its `caption` prop, the only labelling channel, was never
                      * passed here). It is visually hidden, matching what the caption
                      * would have been.
                      */}
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
