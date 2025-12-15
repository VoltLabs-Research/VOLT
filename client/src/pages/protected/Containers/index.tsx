import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Square, Terminal, Box, Plus } from 'lucide-react';
import { RiDeleteBin6Line, RiEyeLine, RiTerminalLine } from 'react-icons/ri';
import useToast from '@/hooks/ui/use-toast';
import DocumentListing, { type ColumnConfig, StatusBadge } from '@/components/organisms/common/DocumentListing';
import ContainerTerminal from '@/components/organisms/containers/ContainerTerminal';
import DashboardContainer from '@/components/atoms/dashboard/DashboardContainer';
import useDashboardSearchStore from '@/stores/ui/dashboard-search';
import formatTimeAgo from '@/utilities/formatTimeAgo';
import containerApi from '@/services/api/container';
import './Containers.css';

interface Container {
    _id: string;
    name: string;
    image: string;
    status: string;
    containerId: string;
    team: {
        _id: string;
        name: string;
    };
    createdAt: string;
    ports?: Array<{ public: number; private: number }>;
}

const Containers: React.FC = () => {
    const [containers, setContainers] = useState<Container[]>([]);
    const [loading, setLoading] = useState(true);
    const [terminalContainer, setTerminalContainer] = useState<Container | null>(null);
    const { showSuccess, showError } = useToast();
    const navigate = useNavigate();
    const searchQuery = useDashboardSearchStore((s) => s.query);

    const fetchContainers = useCallback(async () => {
        try {
            const containers = await containerApi.getAll({ q: searchQuery });
            setContainers(containers);
        } catch (error) {
            console.error('Failed to fetch containers:', error);
        } finally {
            setLoading(false);
        }
    }, [searchQuery]);

    useEffect(() => {
        fetchContainers();
        const interval = setInterval(fetchContainers, 5000);
        return () => clearInterval(interval);
    }, [fetchContainers]);

    const handleControl = async (container: Container, action: 'start' | 'stop') => {
        try {
            await containerApi.control(container._id, action);
            showSuccess(`Container ${action}ed successfully`);
            fetchContainers();
        } catch (error: any) {
            showError(error.response?.data?.message || `Failed to ${action} container`);
        }
    };

    const handleDelete = async (container: Container) => {
        if (!window.confirm(`Are you sure you want to delete container "${container.name}"?`)) {
            return;
        }
        try {
            await containerApi.delete(container._id);
            showSuccess('Container deleted successfully');
            fetchContainers();
        } catch (error: any) {
            showError(error.response?.data?.message || 'Failed to delete container');
        }
    };

    const handleMenuAction = useCallback(async (action: string, item: Container) => {
        switch (action) {
            case 'view':
                navigate(`/dashboard/containers/${item._id}`);
                break;
            case 'terminal':
                if (item.status === 'running') {
                    setTerminalContainer(item);
                } else {
                    showError('Container must be running to open terminal');
                }
                break;
            case 'start':
                await handleControl(item, 'start');
                break;
            case 'stop':
                await handleControl(item, 'stop');
                break;
            case 'delete':
                await handleDelete(item);
                break;
        }
    }, [navigate, showError]);

    const getMenuOptions = useCallback((item: Container) => {
        const options: any[] = [
            ['View Details', RiEyeLine, () => handleMenuAction('view', item)]
        ];

        if (item.status === 'running') {
            options.push(
                ['Open Terminal', RiTerminalLine, () => handleMenuAction('terminal', item)],
                ['Stop', Square, () => handleMenuAction('stop', item)]
            );
        } else {
            options.push(['Start', Play, () => handleMenuAction('start', item)]);
        }

        options.push(['Delete', RiDeleteBin6Line, () => handleMenuAction('delete', item)]);

        return options;
    }, [handleMenuAction]);

    const StatusBadgeContainer = ({ status }: { status: string }) => {
        const statusLower = status.toLowerCase();
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
                <div className='d-flex items-center gap-075 container-name-cell'>
                    <div className='d-flex flex-center container-icon-small'>
                        <Box size={16} />
                    </div>
                    <div className='d-flex column gap-0125 container-name-content'>
                        <span className='container-name-text'>{value}</span>
                        <span className='container-id-text'>{row.containerId?.substring(0, 12)}</span>
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
            render: (value) => <span className='container-image-text'>{value}</span>,
            skeleton: { variant: 'text', width: 150 }
        },
        {
            title: 'Ports',
            key: 'ports',
            render: (value) => {
                if (!value || value.length === 0) return <span className='text-muted'>-</span>;
                const port = value[0];
                return (
                    <span className='container-port-text'>
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
                <span className='text-muted' title={new Date(value).toLocaleString()}>
                    {formatTimeAgo(value)}
                </span>
            ),
            skeleton: { variant: 'text', width: 90 }
        }
    ], []);

    return (
        <DashboardContainer pageName='Containers' className='d-flex column h-100 containers-page-wrapper'>
            <div className='containers-listing-header'>
                <button
                    className='d-flex items-center gap-05 new-container-btn'
                    onClick={() => navigate('/dashboard/containers/new')}
                >
                    <Plus size={18} />
                    <span>New Container</span>
                </button>
            </div>

            <DocumentListing
                title={`Containers(${containers.length})`}
                breadcrumbs={['Dashboard', 'Containers']}
                columns={columns}
                data={containers}
                isLoading={loading}
                onMenuAction={handleMenuAction}
                getMenuOptions={getMenuOptions}
                emptyMessage='No containers found. Create one to get started.'
                keyExtractor={(item) => item._id}
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
