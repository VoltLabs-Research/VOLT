import ContainerTerminal from '../../organisms/ContainerTerminal';
import { ContainerAction } from '../../../api/dtos/update-container';
import { containerQuery } from '../../../hooks/queries';
import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Square, Box, RotateCcw } from 'lucide-react';
import { RiTerminalLine } from 'react-icons/ri';
import useListingActions from '@/shared/presentation/hooks/use-listing-actions';
import usePermission from '@/shared/presentation/hooks/use-permission';
import { showPromise } from '@/shared/presentation/hooks/toast';
import { dateColumn, statusColumn } from '@/shared/presentation/utilities/column-presets';
import { sileo } from 'sileo';
import DocumentListing from '@/shared/presentation/components/DocumentListing';
import Container from '@/shared/presentation/components/Container';
import type { PaginationParams } from '@/shared/presentation/hooks/use-pagination-params';
import type { ColumnConfig, SocketInvalidationConfig } from '@/shared/presentation/components/DocumentListing';
import type { Container as ContainerEntity } from '@/modules/container/api/entities/container';

const isContainerEntity = (value: unknown): value is ContainerEntity => {
    return typeof value === 'object' && value !== null && 'containerId' in value && 'name' in value;
};

const SOCKET_INVALIDATION: SocketInvalidationConfig[] = [
    { event: 'container.created', queryKeys: [containerQuery.QUERY_KEYS.lists()] },
    { event: 'container.deleted', queryKeys: [containerQuery.QUERY_KEYS.lists()] }
];

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

const COLUMNS: ColumnConfig<ContainerEntity>[] = [
    {
        key: 'name',
        title: 'Name',
        sortable: true,
        render: (value, row) => {
            if (!isContainerEntity(row)) {
                return null;
            }

            return (
                <Container className='d-flex items-center gap-075'>
                    <Container className='d-flex flex-center color-primary'>
                        <Box size={16} />
                    </Container>
                    <Container className='d-flex column gap-025 overflow-hidden'>
                        <span className='font-weight-6 color-primary'>{String(value)}</span>
                        <span className='font-size-1 color-muted'>{row.containerId.substring(0, 12)}</span>
                    </Container>
                </Container>
            );
        },
        skeleton: { variant: 'text', width: 180 }
    },
    statusColumn<ContainerEntity>('status', 'Status', {
        sortable: true,
        width: 80,
        resolveStatus: (value) => STATUS_MAP[String(value).toLowerCase()] ?? 'processing'
    }),
    {
        key: 'image',
        title: 'Image',
        sortable: true,
        render: (value) => <span className='font-size-2 color-secondary'>{String(value)}</span>,
        skeleton: { variant: 'text', width: 150 }
    },
    {
        key: 'internalIp',
        title: 'Internal IP',
        render: (value) => <span className='font-size-2 color-secondary font-family-mono'>{String(value)}</span>,
        skeleton: { variant: 'text', width: 120 }
    },
    {
        key: 'ports',
        title: 'Ports',
        render: (_, row) => {
            if (!isContainerEntity(row)) {
                return null;
            }

            const port = row.ports?.[0];
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
    dateColumn<ContainerEntity>('createdAt', 'Created', {
        width: 90,
        withTitle: true
    })
];

const ContainersListing = () => {
    const navigate = useNavigate();
    const [terminalContainer, setTerminalContainer] = useState<ContainerEntity | null>(null);
    const canCreate = usePermission(['container:create']);

    const updateContainerMutation = containerQuery.useUpdateMutation();
    const deleteContainerMutation = containerQuery.useDeleteMutation();

    const fetchData = useCallback(async (params: PaginationParams) => {
        return await containerQuery.useListQuery.fetch({
            page: params.page,
            limit: params.limit,
            search: params.search
        });
    }, []);

    const controlContainer = useCallback(async (containerId: string, action: ContainerAction) => {
        await updateContainerMutation.mutateAsync({ id: containerId, params: { action } });
    }, [updateContainerMutation]);

    const deleteContainer = useCallback(async (containerId: string) => {
        await deleteContainerMutation.mutateAsync(containerId);
    }, [deleteContainerMutation]);

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
                        controlContainer(container._id, ContainerAction.Start),
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
                        controlContainer(container._id, ContainerAction.Stop),
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
                        controlContainer(container._id, ContainerAction.Restart),
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
                confirm: ({ selectedItems }) => {
                    let message = `Delete ${selectedItems.length} containers? This action cannot be undone.`;
                    if (selectedItems.length === 1) {
                        message = `Delete container "${selectedItems[0].name}"? This action cannot be undone.`;
                    }

                    return message;
                },
                requiredPermission: 'container:delete'
            }
        }
    });

    let createNew;
    if (canCreate) {
        createNew = {
            buttonTitle: 'New Container',
            onCreate: () => navigate('/dashboard/containers/new')
        };
    }

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
                queryKey={containerQuery.QUERY_KEYS.lists()}
                columns={COLUMNS}
                fetchData={fetchData}
                getMenuOptions={getDynamicMenuOptions}
                emptyMessage='No containers found. Create one to get started.'
                createNew={createNew}
                socketInvalidation={SOCKET_INVALIDATION}
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
