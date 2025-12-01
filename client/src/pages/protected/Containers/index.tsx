import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Plus,
    Search,
    RefreshCw,
    Box,
    Play,
    Square,
    Terminal
} from 'lucide-react';
import { api } from '@/api';
import useToast from '@/hooks/ui/use-toast';
import CreateContainerModal from '@/components/organisms/containers/CreateContainerModal';
import ContainerTerminal from '@/components/organisms/containers/ContainerTerminal';
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
}

const Containers: React.FC = () => {
    const [containers, setContainers] = useState<Container[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [terminalContainer, setTerminalContainer] = useState<Container | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const { showSuccess, showError } = useToast();
    const navigate = useNavigate();

    const fetchContainers = async () => {
        try {
            const response = await api.get('/containers');
            setContainers(response.data.data.containers);
        } catch (error) {
            console.error('Failed to fetch containers:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchContainers();
        const interval = setInterval(fetchContainers, 5000);
        return () => clearInterval(interval);
    }, []);

    const handleControl = async (e: React.MouseEvent, id: string, action: 'start' | 'stop') => {
        e.stopPropagation();
        try {
            await api.post(`/containers/${id}/control`, { action });
            showSuccess(`Container ${action}ed successfully`);
            fetchContainers();
        } catch (error: any) {
            showError(error.response?.data?.message || `Failed to ${action} container`);
        }
    };

    const handleCardClick = (id: string) => {
        navigate(`/dashboard/containers/${id}`);
    };

    const filteredContainers = containers.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.image.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className='containers-page'>
            <div className='containers-header'>
                <div className='header-content'>
                    <h1>Containers</h1>
                    <p>Manage and monitor your containerized applications.</p>
                </div>
                <div className='header-actions'>
                    <button className='icon-btn' onClick={fetchContainers} title="Refresh">
                        <RefreshCw size={20} />
                    </button>
                    <button className='primary-btn' onClick={() => navigate('/dashboard/containers/new')}>
                        <Plus size={20} />
                        <span>New Container</span>
                    </button>
                </div>
            </div>

            <div className='containers-controls'>
                <div className='search-wrapper'>
                    <Search className='search-icon' size={18} />
                    <input
                        type="text"
                        placeholder="Search containers..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className='containers-table-wrapper'>
                <table className='containers-table'>
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Status</th>
                            <th>Image</th>
                            <th>Created</th>
                            <th className='actions-col'>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan={5} className='loading-cell'>Loading containers...</td>
                            </tr>
                        ) : filteredContainers.length === 0 ? (
                            <tr>
                                <td colSpan={5} className='empty-cell'>
                                    <div className='empty-state'>
                                        <Box size={32} />
                                        <p>No containers found</p>
                                        <button className='text-btn' onClick={() => navigate('/dashboard/containers/new')}>
                                            Create one now
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            filteredContainers.map(container => (
                                <tr
                                    key={container._id}
                                    onClick={() => handleCardClick(container._id)}
                                    className='container-row'
                                >
                                    <td className='name-cell'>
                                        <div className='name-wrapper'>
                                            <div className='container-icon'>
                                                <Box size={16} />
                                            </div>
                                            <div>
                                                <span className='container-name'>{container.name}</span>
                                                <span className='container-id'>{container.containerId.substring(0, 12)}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <div className={`status-badge ${container.status}`}>
                                            <span className='status-dot'></span>
                                            {container.status}
                                        </div>
                                    </td>
                                    <td className='monospace'>{container.image}</td>
                                    <td className='text-muted'>{new Date(container.createdAt).toLocaleDateString()}</td>
                                    <td className='actions-cell'>
                                        <div className='row-actions'>
                                            {container.status !== 'running' ? (
                                                <button
                                                    className='action-icon start'
                                                    onClick={(e) => handleControl(e, container._id, 'start')}
                                                    title="Start"
                                                >
                                                    <Play size={16} />
                                                </button>
                                            ) : (
                                                <button
                                                    className='action-icon stop'
                                                    onClick={(e) => handleControl(e, container._id, 'stop')}
                                                    title="Stop"
                                                >
                                                    <Square size={16} />
                                                </button>
                                            )}
                                            <button
                                                className='action-icon terminal'
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setTerminalContainer(container);
                                                }}
                                                disabled={container.status !== 'running'}
                                                title="Terminal"
                                            >
                                                <Terminal size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            <CreateContainerModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onSuccess={fetchContainers}
            />

            {terminalContainer && (
                <ContainerTerminal
                    container={terminalContainer}
                    onClose={() => setTerminalContainer(null)}
                />
            )}
        </div>
    );
};

export default Containers;
