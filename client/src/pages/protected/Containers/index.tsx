import React, { useState, useMemo, useCallback } from 'react';
import { usePageTitle } from '@/hooks/core/use-page-title';
import { useNavigate } from 'react-router-dom';
import { Play, Square, Box } from 'lucide-react';
import { RiDeleteBin6Line, RiEyeLine, RiTerminalLine } from 'react-icons/ri';
import useToast from '@/hooks/ui/use-toast';
import DocumentListing, { type ColumnConfig, StatusBadge } from '@/components/organisms/common/DocumentListing';
import ContainerTerminal from '@/components/organisms/containers/ContainerTerminal';
import DashboardContainer from '@/components/atoms/dashboard/DashboardContainer';
import { formatDistanceToNow } from 'date-fns';
import containerApi from '@/services/api/container/container';
import useContainerStore, { type Container } from '@/stores/slices/container';
import useListingLifecycle from '@/hooks/common/use-listing-lifecycle';
import useConfirm from '@/hooks/ui/use-confirm';
import './Containers.css';

const Containers: React.FC = () => {
    usePageTitle('Containers');
    const containers = useContainerStore((state) => state.containers);
    const fetchContainers = useContainerStore((state) => state.fetchContainers);
    const resetContainers = useContainerStore((state) => state.resetContainers);
    // Align loading naming or use store directly
    const loading = useContainerStore((state) => state.isLoading);
    const isFetchingMore = useContainerStore((state) => state.isFetchingMore);
    const listingMeta = useContainerStore((state) => state.listingMeta);

    const [terminalContainer, setTerminalContainer] = useState<Container | null>(null);
    const { showSuccess, showError } = useToast();
    const navigate = useNavigate();
    const { confirm } = useConfirm();

    // We pass these directly to DocumentListing
    const lifecycleProps = {
        listingMeta,
        fetchData: fetchContainers,
        initialFetchParams: { page: 1, limit: 20 },
        dependencies: [fetchContainers]
    };

    // Reset state on unmount
    React.useEffect(() => {
        return () => {
            resetContainers();
        };
    }, [resetContainers]);

    const handleControl = useCallback(async (container: Container, action: 'start' | 'stop') => {
        try {
            await containerApi.control(container._id, action);
            showSuccess(`Container ${action}ed successfully`);
            fetchContainers({ page: 1, force: true });
        } catch (error: any) {
            showError(error.response?.data?.message || `Failed to ${action} container`);
        }
    }, [showSuccess, showError, fetchContainers]);

    const handleDelete = useCallback(async (container: Container) => {
        if (!await confirm(`Delete container "${container.name}"? This action cannot be undone.`)) {
            return;
        }
        try {
            await containerApi.delete(container._id);
            showSuccess('Container deleted successfully');
            fetchContainers({ page: 1, force: true });
        } catch (error: any) {
            showError(error.response?.data?.message || 'Failed to delete container');
        }
    }, [confirm, showSuccess, showError, fetchContainers]);

    const handleMenuAction = useCallback(async (action: string, item: any) => {
        // Cast item to Container
        const container = item as Container;
        switch (action) {
            case 'view':
                navigate(`/dashboard/containers/${container._id}`);
                break;
            case 'terminal':
                if (container.status === 'running') {
                    setTerminalContainer(container);
                } else {
                    showError('Container must be running to open terminal');
                }
                break;
            case 'start':
                await handleControl(container, 'start');
                break;
            case 'stop':
                await handleControl(container, 'stop');
                break;
            case 'delete':
                await handleDelete(container);
                break;
        }
    }, [navigate, showError, handleControl, handleDelete]);

    const getMenuOptions = useCallback((item: any) => {
        const container = item as Container;
        const options: any[] = [
            ['View Details', RiEyeLine, () => handleMenuAction('view', container)]
        ];

        if (container.status === 'running') {
            options.push(
                ['Open Terminal', RiTerminalLine, () => handleMenuAction('terminal', container)],
                ['Stop', Square, () => handleMenuAction('stop', container)]
            );
        } else {
            options.push(['Start', Play, () => handleMenuAction('start', container)]);
        }

        options.push(['Delete', RiDeleteBin6Line, () => handleMenuAction('delete', container)]);

        return options;
    }, [handleMenuAction]);

    const StatusBadgeContainer = ({ status }: { status: string }) => {
        const statusLower = status?.toLowerCase() || 'unknown';
        // Map Docker container states to our badge system
        const statusMap: Record<string, string> = {
            running: 'ready',
            exited: 'failed',
            stopped: 'failed',
            created: 'processing',
            restarting: 'processing',
            paused: 'processing',
            dead: 'failed',
            removing: 'processing'
        };
        return <StatusBadge status={statusMap[statusLower] || 'processing'} />;
    };

    const columns: ColumnConfig[] = useMemo(() => [
        {
            title: 'Name',
            key: 'name',
            sortable: true,
            render: (value, row) => (
                <div className='d-flex items-center gap-075 sm:column sm:items-start sm:gap-05 container-name-cell'>
                    <div className='d-flex flex-center container-icon-small color-primary'>
                        <Box size={16} />
                    </div>
                    <div className='d-flex column gap-025 container-name-content overflow-hidden'>
                        <span className='container-name-text font-weight-6 color-primary'>{value}</span>
                        <span className='container-id-text font-size-1 color-muted'>{row.containerId?.substring(0, 12)}</span>
                    </div>
                </div>
            ),
            skeleton: { variant: 'text', width: 180 }
        },
        {
            title: 'Status',
            key: 'status',
            sortable: true,
            render: (value) => <StatusBadgeContainer status={value} />,
            skeleton: { variant: 'rounded', width: 80, height: 24 }
        },
        {
            title: 'Image',
            key: 'image',
            sortable: true,
            render: (value) => <span className='container-image-text font-size-2 color-secondary'>{value}</span>,
            skeleton: { variant: 'text', width: 150 }
        },
        {
            title: 'Internal IP',
            key: 'internalIp',
            render: (value) => {
                if (!value) return <span className='text-muted font-size-2 color-muted'>-</span>;
                return (
                    <span className='font-size-2 color-secondary font-family-mono'>
                        {value}
                    </span>
                );
            },
            skeleton: { variant: 'text', width: 120 }
        },
        {
            title: 'Ports',
            key: 'ports',
            render: (value) => {
                if (!value || value.length === 0) return <span className='text-muted font-size-2 color-muted'>-</span>;
                const port = value[0];
                return (
                    <span className='container-port-text font-size-2 font-weight-5'>
                        {port.private} → {port.public}
                    </span>
                );
            },
            skeleton: { variant: 'text', width: 100 }
        },
        {
            title: 'Created',
            key: 'createdAt',
            sortable: true,
            render: (value) => (
                <span className='text-muted font-size-2 color-muted' title={new Date(value).toLocaleString()}>
                    {formatDistanceToNow(value, { addSuffix: true })}
                </span>
            ),
            skeleton: { variant: 'text', width: 90 }
        }
    ], []);

    return (
        <DashboardContainer className='d-flex column h-max'>
            <DocumentListing
                title={`Containers(${listingMeta.total || containers.length})`}
                columns={columns}
                data={containers}
                isLoading={loading}
                onMenuAction={handleMenuAction}
                getMenuOptions={getMenuOptions}
                emptyMessage='No containers found. Create one to get started.'
                keyExtractor={(item) => item._id}


                {...lifecycleProps}
                createNew={{
                    buttonTitle: 'New Container',
                    onCreate: () => navigate('/dashboard/containers/new')
                }}
            />

            {terminalContainer && (
                <ContainerTerminal
                    container={terminalContainer}
                    onClose={() => setTerminalContainer(null)}
                />
            )}
        </DashboardContainer>
    );
};

export default Containers;
