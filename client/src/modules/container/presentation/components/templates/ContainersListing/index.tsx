import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Square, Box, RotateCcw } from 'lucide-react';
import { RiTerminalLine } from 'react-icons/ri';
import { formatDistanceToNow } from 'date-fns';
import useContainerUseCases from '../../../hooks/use-container-repository';
import useListingActions from '@/shared/presentation/hooks/use-listing-actions';
import usePermission from '@/shared/presentation/hooks/use-permission';
import { showPromise } from '@/shared/presentation/hooks/toast';
import { sileo } from 'sileo';
import DocumentListing, { type ColumnConfig, createListSyncConfig } from '@/shared/presentation/components/DocumentListing';
import StatusBadge from '@/shared/presentation/components/StatusBadge';
import Container from '@/shared/presentation/components/Container';
import type { PaginationParams } from '@/shared/presentation/hooks/use-pagination-params';
import ContainerTerminal from '../../organisms/ContainerTerminal';
import type { Container as ContainerEntity } from '@/modules/container/domain/entities';

const LIST_SYNC = createListSyncConfig('container');

const STATUS_MAP: Record<string, string> = {
    running: 'ready',
    exited: 'failed',
    stopped: 'failed',
    created: 'processing',
    restarting: 'processing',
    paused: 'processing',
    dead: 'failed',
    removing: 'processing',
    unknown: 'processing'
};

const COLUMNS: ColumnConfig[] = [
    {
        key: 'name',
        title: 'Name',
        sortable: true,
        render: (value, row) => {
            const container = row as ContainerEntity;
            return (
                <Container className='d-flex items-center gap-075'>
                    <Container className='d-flex flex-center color-primary'>
                        <Box size={16} />
                    </Container>
                    <Container className='d-flex column gap-025 overflow-hidden'>
                        <span className='font-weight-6 color-primary'>{value as string}</span>
                        <span className='font-size-1 color-muted'>{container.containerId.substring(0, 12)}</span>
                    </Container>
                </Container>
            );
        },
        skeleton: { variant: 'text', width: 180 }
    },
    {
        key: 'status',
        title: 'Status',
        sortable: true,
        render: (value) => {
            const statusLower = String(value).toLowerCase();
            return <StatusBadge status={STATUS_MAP[statusLower]} />;
        },
        skeleton: { variant: 'rounded', width: 80, height: 24 }
    },
    {
        key: 'image',
        title: 'Image',
        sortable: true,
        render: (value) => <span className='font-size-2 color-secondary'>{value as string}</span>,
        skeleton: { variant: 'text', width: 150 }
    },
    {
        key: 'internalIp',
        title: 'Internal IP',
        render: (value) => <span className='font-size-2 color-secondary font-family-mono'>{value as string}</span>,
        skeleton: { variant: 'text', width: 120 }
    },
    {
        key: 'ports',
        title: 'Ports',
        render: (_, row) => {
            const port = (row as ContainerEntity).ports?.[0];
            if(!port){
                return <span className='font-size-2 color-muted'>No ports</span>;
            }
            return (
                <span className='font-size-2 font-weight-5'>
                    {port.private} {'->'} {port.public}
                </span>
            );
        },
        skeleton: { variant: 'text', width: 100 }
    },
    {
        key: 'createdAt',
        title: 'Created',
        sortable: true,
        render: (value) => (
            <span className='font-size-2 color-muted' title={new Date(value as string).toLocaleString()}>
                {formatDistanceToNow(new Date(value as string), { addSuffix: true })}
            </span>
        ),
        skeleton: { variant: 'text', width: 90 }
    }
];

const ContainersListing = () => {
    const navigate = useNavigate();
    const [terminalContainer, setTerminalContainer] = useState<ContainerEntity | null>(null);
    const canCreate = usePermission(['container:create']);

    const { containerRepository } = useContainerUseCases();

    const fetchData = useCallback(async (params: PaginationParams) => {
        return await containerRepository.getAll({
            page: params.page,
            limit: params.limit,
            search: params.search
        });
    }, [containerRepository]);

    const controlContainer = useCallback(async (containerId: string, action: 'start' | 'stop' | 'restart') => {
        await containerRepository.update(containerId, { action });
    }, [containerRepository]);

    const deleteContainer = useCallback(async (containerId: string) => {
        await containerRepository.delete(containerId);
    }, [containerRepository]);

    const { getMenuOptions } = useListingActions<ContainerEntity>({
        actions: {
            view: {
                label: 'View Details',
                handler: ({ item: container }) => navigate(`/dashboard/containers/${container._id}`),
                requiredPermission: 'container:read'
            },
            terminal: {
                label: 'Open Terminal',
                icon: RiTerminalLine,
                handler: ({ item: container }) => {
                    if(container.status === 'running'){
                        setTerminalContainer(container);
                    }else{
                        sileo.error({ title: 'Container must be running to open terminal' });
                    }
                },
                requiredPermission: 'container:read'
            },
            start: {
                label: 'Start',
                icon: () => <Play size={16} />,
                handler: async ({ item: container }) => {
                    if(container.status === 'running') return;
                    await showPromise(
                        controlContainer(container._id, 'start'),
                        {
                            loading: { title: 'Starting container...' },
                            success: { title: 'Container started successfully' },
                            error: { title: 'Failed to start container' }
                        }
                    );
                },
                requiredPermission: 'container:update'
            },
            stop: {
                label: 'Stop',
                icon: () => <Square size={16} />,
                handler: async ({ item: container }) => {
                    if(container.status !== 'running') return;
                    await showPromise(
                        controlContainer(container._id, 'stop'),
                        {
                            loading: { title: 'Stopping container...' },
                            success: { title: 'Container stopped successfully' },
                            error: { title: 'Failed to stop container' }
                        }
                    );
                },
                requiredPermission: 'container:update'
            },
            restart: {
                label: 'Restart',
                icon: () => <RotateCcw size={16} />,
                handler: async ({ item: container }) => {
                    await showPromise(
                        controlContainer(container._id, 'restart'),
                        {
                            loading: { title: 'Restarting container...' },
                            success: { title: 'Container restarted successfully' },
                            error: { title: 'Failed to restart container' }
                        }
                    );
                },
                requiredPermission: 'container:update'
            },
            delete: {
                variant: 'danger',
                handler: async ({ item: container }) => {
                    await showPromise(
                        deleteContainer(container._id),
                        {
                            loading: { title: 'Deleting container...' },
                            success: { title: 'Container deleted successfully' },
                            error: { title: 'Failed to delete container' }
                        }
                    );
                },
                confirm: ({ selectedItems }) => (
                    selectedItems.length === 1
                        ? `Delete container "${selectedItems[0].name}"? This action cannot be undone.`
                        : `Delete ${selectedItems.length} containers? This action cannot be undone.`
                ),
                requiredPermission: 'container:delete'
            }
        }
    });

    const getDynamicMenuOptions = useCallback((item: ContainerEntity, selectedContainers: ContainerEntity[]) => {
        const options = getMenuOptions(item, selectedContainers);
        return options.filter((opt) => {
            if(opt.label === 'Start' && item.status === 'running') return false;
            if(opt.label === 'Stop' && item.status !== 'running') return false;
            if(opt.label === 'Open Terminal' && item.status !== 'running') return false;
            return true;
        });
    }, [getMenuOptions]);

    return (
        <>
            <DocumentListing<ContainerEntity>
                title='Containers'
                columns={COLUMNS}
                fetchData={fetchData}
                getMenuOptions={getDynamicMenuOptions}
                emptyMessage='No containers found. Create one to get started.'
                createNew={canCreate ? {
                    buttonTitle: 'New Container',
                    onCreate: () => navigate('/dashboard/containers/new')
                } : undefined}
                listSyncConfig={LIST_SYNC}
            />

            {terminalContainer && (
                <ContainerTerminal
                    container={terminalContainer}
                    onClose={() => setTerminalContainer(null)}
                />
            )}
        </>
    );
};

export default ContainersListing;
