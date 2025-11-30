import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    Play,
    Square,
    RefreshCw,
    Trash2,
    Terminal,
    Folder,
    Settings,
    Copy,
    ExternalLink,
    Box,
    Clock,
    Hash,
    Layers,
    Globe
} from 'lucide-react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from 'recharts';
import { api } from '@/api';
import useToast from '@/hooks/ui/use-toast';
import ContainerTerminal from '@/components/organisms/containers/ContainerTerminal';
import ContainerFileExplorer from '@/components/organisms/containers/ContainerFileExplorer';
import EditContainerModal from '@/components/organisms/containers/EditContainerModal';
import './ContainerDetails.css';

const ContainerDetails: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { showSuccess, showError } = useToast();

    const [container, setContainer] = useState<any>(null);
    const [statsHistory, setStatsHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'overview' | 'logs' | 'storage' | 'settings'>('overview');
    const [actionLoading, setActionLoading] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    useEffect(() => {
        fetchContainer();
    }, [id]);

    useEffect(() => {
        if (container && container.status === 'running') {
            const interval = setInterval(() => fetchStats(container._id), 2000);
            return () => clearInterval(interval);
        }
    }, [container]);

    const fetchContainer = async () => {
        try {
            const res = await api.get('/containers');
            const found = res.data.data.containers.find((c: any) => c._id === id);
            if (found) {
                setContainer(found);
            } else {
                showError('Container not found');
                navigate('/dashboard/containers');
            }
        } catch (error) {
            showError('Failed to fetch container details');
            navigate('/dashboard/containers');
        } finally {
            setLoading(false);
        }
    };

    const fetchStats = async (containerId: string) => {
        try {
            const res = await api.get(`/containers/${containerId}/stats`);
            const newStats = res.data.data.stats;

            // Calculate CPU %
            // Calculate CPU %
            let cpuPercent = 0;
            const cpuDelta = newStats.cpu_stats.cpu_usage.total_usage - newStats.precpu_stats.cpu_usage.total_usage;
            const systemDelta = newStats.cpu_stats.system_cpu_usage - newStats.precpu_stats.system_cpu_usage;
            const onlineCpus = newStats.cpu_stats.online_cpus || newStats.cpu_stats.cpu_usage.percpu_usage?.length || 1;

            if (systemDelta > 0 && cpuDelta > 0) {
                cpuPercent = (cpuDelta / systemDelta) * onlineCpus * 100;
            }

            // Calculate Memory MB
            const memoryUsage = newStats.memory_stats.usage / 1024 / 1024;

            setStatsHistory(prev => {
                const updated = [...prev, {
                    time: new Date().toLocaleTimeString(),
                    cpu: isNaN(cpuPercent) ? 0 : cpuPercent,
                    memory: memoryUsage
                }];
                return updated.slice(-30); // Keep last 30 points
            });

        } catch (error) {
            console.error('Failed to fetch stats', error);
        }
    };

    const handleAction = async (action: 'start' | 'stop' | 'restart' | 'delete') => {
        if (!container) return;
        setActionLoading(true);
        try {
            if (action === 'delete') {
                if (!window.confirm('Are you sure you want to delete this container?')) {
                    setActionLoading(false);
                    return;
                }
                await api.delete(`/containers/${container._id}`);
                showSuccess('Container deleted');
                navigate('/dashboard/containers');
                return;
            }

            if (action === 'restart') {
                await api.post(`/containers/${container._id}/restart`);
            } else {
                await api.post(`/containers/${container._id}/control`, { action });
            }

            showSuccess(`Container ${action}ed successfully`);
            fetchContainer();
        } catch (error: any) {
            showError(error.response?.data?.message || `Failed to ${action} container`);
        } finally {
            setActionLoading(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        showSuccess('Copied to clipboard');
    };

    const calculateUptime = (startDate: string) => {
        const start = new Date(startDate).getTime();
        const now = new Date().getTime();
        const diff = now - start;

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        if (days > 0) return `${days}d ${hours}h`;
        if (hours > 0) return `${hours}h ${minutes}m`;
        return `${minutes}m`;
    };

    if (loading) return <div className="loading-spinner">Loading...</div>;
    if (!container) return null;

    return (
        <div className="details-page">
            <div className="details-header">
                <div className="header-top">
                    <button onClick={() => navigate('/dashboard/containers')} className="back-link">
                        <ArrowLeft size={16} />
                        Back to Containers
                    </button>
                    <div className="header-actions">
                        {container.status !== 'running' ? (
                            <button
                                onClick={() => handleAction('start')}
                                disabled={actionLoading}
                                className="action-btn start"
                            >
                                <Play size={16} /> Start
                            </button>
                        ) : (
                            <>
                                <button
                                    onClick={() => handleAction('restart')}
                                    disabled={actionLoading}
                                    className="action-btn"
                                >
                                    <RefreshCw size={16} /> Restart
                                </button>
                                <button
                                    onClick={() => handleAction('stop')}
                                    disabled={actionLoading}
                                    className="action-btn stop"
                                >
                                    <Square size={16} /> Stop
                                </button>
                            </>
                        )}
                        {container.ports?.[0] && (
                            <a
                                href={`http://localhost:${container.ports[0].public}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="visit-btn"
                            >
                                Visit <ExternalLink size={14} />
                            </a>
                        )}
                    </div>
                </div>

                <div className="header-main">
                    <div className="title-section">
                        <div className="container-icon">
                            <Box size={32} />
                        </div>
                        <div>
                            <h1>{container.name}</h1>
                            <div className="meta-row">
                                <span className="meta-item">
                                    <span className={`status-dot ${container.status}`}></span>
                                    {container.status}
                                </span>
                                <span className="meta-item monospace">
                                    {container.containerId.substring(0, 12)}
                                    <Copy
                                        size={12}
                                        className="copy-icon"
                                        onClick={() => copyToClipboard(container.containerId)}
                                    />
                                </span>
                                <span className="meta-item">{container.image}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="tabs-nav">
                    <button
                        className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
                        onClick={() => setActiveTab('overview')}
                    >
                        Overview
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'logs' ? 'active' : ''}`}
                        onClick={() => setActiveTab('logs')}
                    >
                        Logs
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'storage' ? 'active' : ''}`}
                        onClick={() => setActiveTab('storage')}
                    >
                        Storage
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
                        onClick={() => setActiveTab('settings')}
                    >
                        Settings
                    </button>
                </div>
            </div>

            <div className="details-content">
                {activeTab === 'overview' && (
                    <div className="tab-pane overview-pane">
                        <div className="info-grid">
                            <div className="info-card">
                                <div className="card-header-small">
                                    <Clock size={16} /> Uptime
                                </div>
                                <div className="card-value">
                                    {container.status === 'running'
                                        ? calculateUptime(container.createdAt) // Ideally use startedAt if available
                                        : 'Not running'}
                                </div>
                            </div>
                            <div className="info-card">
                                <div className="card-header-small">
                                    <Layers size={16} /> Image
                                </div>
                                <div className="card-value monospace small">
                                    {container.image}
                                </div>
                            </div>
                            <div className="info-card">
                                <div className="card-header-small">
                                    <Hash size={16} /> ID
                                </div>
                                <div className="card-value monospace small">
                                    {container.containerId.substring(0, 12)}
                                </div>
                            </div>
                            <div className="info-card">
                                <div className="card-header-small">
                                    <Globe size={16} /> Ports
                                </div>
                                <div className="card-value small">
                                    {container.ports?.length > 0
                                        ? container.ports.map((p: any) => `${p.public}:${p.private}`).join(', ')
                                        : 'None'}
                                </div>
                            </div>
                        </div>

                        <div className="stats-grid">
                            <div className="stat-card">
                                <h3>CPU Usage</h3>
                                <div className="chart-wrapper">
                                    <ResponsiveContainer width="100%" height={250}>
                                        <AreaChart data={statsHistory}>
                                            <defs>
                                                <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#0070f3" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="#0070f3" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                                            <XAxis
                                                dataKey="time"
                                                stroke="var(--muted-foreground)"
                                                fontSize={12}
                                                tickLine={false}
                                                axisLine={false}
                                                minTickGap={30}
                                            />
                                            <YAxis
                                                stroke="var(--muted-foreground)"
                                                fontSize={12}
                                                tickLine={false}
                                                axisLine={false}
                                                tickFormatter={(value) => `${value.toFixed(1)}%`}
                                                domain={[0, 'auto']}
                                            />
                                            <Tooltip
                                                contentStyle={{
                                                    backgroundColor: 'var(--card)',
                                                    borderColor: 'var(--border)',
                                                    borderRadius: '8px',
                                                    color: 'var(--foreground)'
                                                }}
                                                itemStyle={{ color: 'var(--foreground)' }}
                                                formatter={(value: number) => [`${value.toFixed(2)}%`, 'CPU Usage']}
                                                labelStyle={{ color: 'var(--muted-foreground)', marginBottom: '0.5rem' }}
                                            />
                                            <Area
                                                type="monotone"
                                                dataKey="cpu"
                                                stroke="#0070f3"
                                                strokeWidth={2}
                                                fillOpacity={1}
                                                fill="url(#colorCpu)"
                                                isAnimationActive={false}
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                            <div className="stat-card">
                                <h3>Memory Usage</h3>
                                <div className="chart-wrapper">
                                    <ResponsiveContainer width="100%" height={250}>
                                        <AreaChart data={statsHistory}>
                                            <defs>
                                                <linearGradient id="colorMem" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                                            <XAxis
                                                dataKey="time"
                                                stroke="var(--muted-foreground)"
                                                fontSize={12}
                                                tickLine={false}
                                                axisLine={false}
                                                minTickGap={30}
                                            />
                                            <YAxis
                                                stroke="var(--muted-foreground)"
                                                fontSize={12}
                                                tickLine={false}
                                                axisLine={false}
                                                tickFormatter={(value) => `${Math.round(value)} MB`}
                                            />
                                            <Tooltip
                                                contentStyle={{
                                                    backgroundColor: 'var(--card)',
                                                    borderColor: 'var(--border)',
                                                    borderRadius: '8px',
                                                    color: 'var(--foreground)'
                                                }}
                                                itemStyle={{ color: 'var(--foreground)' }}
                                                formatter={(value: number) => [`${value.toFixed(2)} MB`, 'Memory Usage']}
                                                labelStyle={{ color: 'var(--muted-foreground)', marginBottom: '0.5rem' }}
                                            />
                                            <Area
                                                type="monotone"
                                                dataKey="memory"
                                                stroke="#10b981"
                                                strokeWidth={2}
                                                fillOpacity={1}
                                                fill="url(#colorMem)"
                                                isAnimationActive={false}
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>

                        <div className="env-section">
                            <h3>Environment Variables</h3>
                            <div className="env-grid">
                                {container.env && container.env.length > 0 ? (
                                    container.env.map((e: any, i: number) => (
                                        <div key={i} className="env-item">
                                            <span className="env-key">{e.key}</span>
                                            <span className="env-value">{e.value}</span>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-muted">No environment variables configured.</p>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'logs' && (
                    <div className="tab-pane full-height">
                        {container.status === 'running' ? (
                            <ContainerTerminal
                                container={container}
                                onClose={() => { }}
                                embedded={true}
                            />
                        ) : (
                            <div className="placeholder-state">
                                <Terminal size={48} />
                                <p>Container must be running to view logs</p>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'storage' && (
                    <div className="tab-pane full-height">
                        {container.status === 'running' ? (
                            <ContainerFileExplorer containerId={container._id} />
                        ) : (
                            <div className="placeholder-state">
                                <Folder size={48} />
                                <p>Container must be running to browse files</p>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'settings' && (
                    <div className="tab-pane settings-pane">
                        <div className="settings-card">
                            <div className="card-header">
                                <h3>Configuration</h3>
                                <p>Update environment variables and port bindings.</p>
                            </div>
                            <div className="card-body">
                                <button
                                    className="secondary-btn"
                                    onClick={() => setIsEditModalOpen(true)}
                                >
                                    <Settings size={16} /> Edit Configuration
                                </button>
                            </div>
                        </div>

                        <div className="settings-card danger">
                            <div className="card-header">
                                <h3>Delete Container</h3>
                                <p>Permanently remove this container and all its data.</p>
                            </div>
                            <div className="card-body">
                                <button
                                    className="danger-btn"
                                    onClick={() => handleAction('delete')}
                                >
                                    <Trash2 size={16} /> Delete Container
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <EditContainerModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                container={container}
                onSuccess={fetchContainer}
            />
        </div>
    );
};

export default ContainerDetails;
