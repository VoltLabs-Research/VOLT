import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    Play,
    Square,
    Trash2,
    Settings,
    Terminal,
    Folder,
    Activity,
    ExternalLink,
    Box,
    Layers,
    RefreshCw
} from 'lucide-react';
import useToast from '@/hooks/ui/use-toast';
import ContainerTerminal from '@/components/organisms/containers/ContainerTerminal';
import ContainerFileExplorer from '@/components/organisms/containers/ContainerFileExplorer';
import ContainerProcesses from '@/components/organisms/containers/ContainerProcesses';
import EditContainerModal from '@/components/organisms/containers/EditContainerModal';
import containerApi from '@/services/api/container';
import Title from '@/components/primitives/Title';
import Paragraph from '@/components/primitives/Paragraph';
import './ContainerDetails.css';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const ContainerDetails: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { showSuccess, showError } = useToast();

    const [container, setContainer] = useState<any>(null);
    const [statsHistory, setStatsHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'overview' | 'processes' | 'logs' | 'storage' | 'settings'>('overview');
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
            const containers = await containerApi.getAll();
            const found = containers.find((c: any) => c._id === id);
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
            const newStats = await containerApi.getStats(containerId);

            let cpuPercent = 0;
            const cpuDelta = newStats.cpu_stats.cpu_usage.total_usage - newStats.precpu_stats.cpu_usage.total_usage;
            const systemDelta = newStats.cpu_stats.system_cpu_usage - newStats.precpu_stats.system_cpu_usage;
            const onlineCpus = newStats.cpu_stats.online_cpus || newStats.cpu_stats.cpu_usage.percpu_usage?.length || 1;

            if (systemDelta > 0 && cpuDelta > 0) {
                cpuPercent = (cpuDelta / systemDelta) * onlineCpus * 100;
            }

            const memoryUsage = newStats.memory_stats.usage / 1024 / 1024;

            setStatsHistory(prev => {
                const updated = [...prev, {
                    time: new Date().toLocaleTimeString(),
                    cpu: isNaN(cpuPercent) ? 0 : cpuPercent,
                    memory: memoryUsage
                }];
                return updated.slice(-30);
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
                await containerApi.delete(container._id);
                showSuccess('Container deleted');
                navigate('/dashboard/containers');
                return;
            }

            if (action === 'restart') {
                await containerApi.restart(container._id);
            } else {
                await containerApi.control(container._id, action);
            }

            showSuccess(`Container ${action}ed successfully`);
            fetchContainer();
        } catch (error: any) {
            showError(error.response?.data?.message || `Failed to ${action} container`);
        } finally {
            setActionLoading(false);
        }
    };

    if (loading) return <div className="loading-spinner">Loading...</div>;
    if (!container) return null;

    return (
        <div className="details-page-layout">
            <div className="details-sidebar">
                <div className="sidebar-header-details">
                    <button onClick={() => navigate('/dashboard/containers')} className="back-link">
                        <ArrowLeft size={16} /> Back
                    </button>
                    <div className="container-identity">
                        <div className="container-icon-large">
                            <Box size={24} />
                        </div>
                        <div className="identity-text">
                            <Title className="font-size-4 font-weight-6">{container.name}</Title>
                            <span className={`status-badge ${container.status}`}>{container.status}</span>
                        </div>
                    </div>
                </div>

                <nav className="sidebar-nav">
                    <button
                        className={`nav-item ${activeTab === 'overview' ? 'active' : ''}`}
                        onClick={() => setActiveTab('overview')}
                    >
                        <Layers size={18} /> Overview
                    </button>
                    <button
                        className={`nav-item ${activeTab === 'processes' ? 'active' : ''}`}
                        onClick={() => setActiveTab('processes')}
                    >
                        <Activity size={18} /> Processes
                    </button>
                    <button
                        className={`nav-item ${activeTab === 'logs' ? 'active' : ''}`}
                        onClick={() => setActiveTab('logs')}
                    >
                        <Terminal size={18} /> Terminal & Logs
                    </button>
                    <button
                        className={`nav-item ${activeTab === 'storage' ? 'active' : ''}`}
                        onClick={() => setActiveTab('storage')}
                    >
                        <Folder size={18} /> Files & Storage
                    </button>
                    <button
                        className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
                        onClick={() => setActiveTab('settings')}
                    >
                        <Settings size={18} /> Settings
                    </button>
                </nav>

                <div className="sidebar-actions">
                    {container.status !== 'running' ? (
                        <button onClick={() => handleAction('start')} disabled={actionLoading} className="action-btn start">
                            <Play size={16} /> Start Container
                        </button>
                    ) : (
                        <>
                            <button onClick={() => handleAction('restart')} disabled={actionLoading} className="action-btn">
                                <RefreshCw size={16} /> Restart
                            </button>
                            <button onClick={() => handleAction('stop')} disabled={actionLoading} className="action-btn stop">
                                <Square size={16} /> Stop
                            </button>
                        </>
                    )}
                    {container.ports?.[0] && (
                        <a href={`http://localhost:${container.ports[0].public}`} target="_blank" rel="noopener noreferrer" className="visit-btn">
                            Visit App <ExternalLink size={14} />
                        </a>
                    )}
                </div>
            </div>

            <div className="details-content-area">
                {activeTab === 'overview' && (
                    <div className="content-pane">
                        <div className="pane-header">
                            <Title className="font-size-4 font-weight-6">Overview</Title>
                            <div className="meta-tags">
                                <span className="tag monospace">ID: {container.containerId.substring(0, 12)}</span>
                                <span className="tag">Image: {container.image}</span>
                                <span className="tag">Created: {new Date(container.createdAt).toLocaleDateString()}</span>
                            </div>
                        </div>

                        <div className="stats-grid">
                            <div className="stat-card">
                                <div className="card-header-row">
                                    <Title className="font-size-3 font-weight-6">CPU Usage</Title>
                                    <span className="limit-badge">Limit: {container.cpus || 1} vCPU</span>
                                </div>
                                <div className="chart-wrapper">
                                    <ResponsiveContainer width="100%" height={250}>
                                        <AreaChart data={statsHistory}>
                                            <defs>
                                                <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#0070f3" stopOpacity={0.4} />
                                                    <stop offset="95%" stopColor="#0070f3" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} opacity={0.5} />
                                            <XAxis
                                                dataKey="time"
                                                stroke="var(--muted-foreground)"
                                                fontSize={11}
                                                tickLine={false}
                                                axisLine={false}
                                                minTickGap={30}
                                                dy={10}
                                            />
                                            <YAxis
                                                stroke="var(--muted-foreground)"
                                                fontSize={11}
                                                tickLine={false}
                                                axisLine={false}
                                                tickFormatter={(value) => `${value.toFixed(1)}%`}
                                                domain={[0, 'auto']}
                                                dx={-10}
                                            />
                                            <Tooltip
                                                contentStyle={{
                                                    backgroundColor: 'var(--card)',
                                                    borderColor: 'var(--border)',
                                                    borderRadius: '12px',
                                                    color: 'var(--foreground)',
                                                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                                                }}
                                                itemStyle={{ color: 'var(--foreground)', fontWeight: 600 }}
                                                formatter={(value: number) => [`${value.toFixed(2)}%`, 'CPU Usage']}
                                                labelStyle={{ color: 'var(--muted-foreground)', marginBottom: '0.5rem', fontSize: '0.8rem' }}
                                                cursor={{ stroke: 'var(--border)', strokeWidth: 1 }}
                                            />
                                            <Area
                                                type="monotone"
                                                dataKey="cpu"
                                                stroke="#0070f3"
                                                strokeWidth={3}
                                                fillOpacity={1}
                                                fill="url(#colorCpu)"
                                                isAnimationActive={true}
                                                animationDuration={1000}
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                            <div className="stat-card">
                                <div className="card-header-row">
                                    <Title className="font-size-3 font-weight-6">Memory Usage</Title>
                                    <span className="limit-badge">Limit: {container.memory || 512} MB</span>
                                </div>
                                <div className="chart-wrapper">
                                    <ResponsiveContainer width="100%" height={250}>
                                        <AreaChart data={statsHistory}>
                                            <defs>
                                                <linearGradient id="colorMem" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                                                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} opacity={0.5} />
                                            <XAxis
                                                dataKey="time"
                                                stroke="var(--muted-foreground)"
                                                fontSize={11}
                                                tickLine={false}
                                                axisLine={false}
                                                minTickGap={30}
                                                dy={10}
                                            />
                                            <YAxis
                                                stroke="var(--muted-foreground)"
                                                fontSize={11}
                                                tickLine={false}
                                                axisLine={false}
                                                tickFormatter={(value) => `${Math.round(value)} MB`}
                                                dx={-10}
                                            />
                                            <Tooltip
                                                contentStyle={{
                                                    backgroundColor: 'var(--card)',
                                                    borderColor: 'var(--border)',
                                                    borderRadius: '12px',
                                                    color: 'var(--foreground)',
                                                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                                                }}
                                                itemStyle={{ color: 'var(--foreground)', fontWeight: 600 }}
                                                formatter={(value: number) => [`${value.toFixed(2)} MB`, 'Memory Usage']}
                                                labelStyle={{ color: 'var(--muted-foreground)', marginBottom: '0.5rem', fontSize: '0.8rem' }}
                                                cursor={{ stroke: 'var(--border)', strokeWidth: 1 }}
                                            />
                                            <Area
                                                type="monotone"
                                                dataKey="memory"
                                                stroke="#8b5cf6"
                                                strokeWidth={3}
                                                fillOpacity={1}
                                                fill="url(#colorMem)"
                                                isAnimationActive={true}
                                                animationDuration={1000}
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>

                        <div className="config-grid">
                            <div className="config-card">
                                <Title className="font-size-3 font-weight-6">Environment Variables</Title>
                                <div className="env-list">
                                    {container.env && container.env.length > 0 ? (
                                        container.env.map((e: any, i: number) => (
                                            <div key={i} className="env-row">
                                                <span className="env-key">{e.key}</span>
                                                <span className="env-val">{e.value}</span>
                                            </div>
                                        ))
                                    ) : (
                                        <Paragraph className="color-muted font-size-2">No environment variables</Paragraph>
                                    )}
                                </div>
                            </div>
                            <div className="config-card">
                                <Title className="font-size-3 font-weight-6">Port Bindings</Title>
                                <div className="port-list">
                                    {container.ports && container.ports.length > 0 ? (
                                        container.ports.map((p: any, i: number) => (
                                            <div key={i} className="port-row">
                                                <span className="port-private">{p.private}/tcp</span>
                                                <span className="arrow">→</span>
                                                <span className="port-public">localhost:{p.public}</span>
                                            </div>
                                        ))
                                    ) : (
                                        <Paragraph className="color-muted font-size-2">No ports exposed</Paragraph>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'processes' && (
                    <div className="content-pane full-height">
                        {container.status === 'running' ? (
                            <ContainerProcesses containerId={container._id} />
                        ) : (
                            <div className="placeholder-state">
                                <Activity size={48} />
                                <Paragraph className="color-muted">Container must be running to view processes</Paragraph>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'logs' && (
                    <div className="content-pane full-height">
                        {container.status === 'running' ? (
                            <ContainerTerminal
                                container={container}
                                onClose={() => { }}
                                embedded={true}
                            />
                        ) : (
                            <div className="placeholder-state">
                                <Terminal size={48} />
                                <Paragraph className="color-muted">Container must be running to view logs</Paragraph>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'storage' && (
                    <div className="content-pane full-height">
                        {container.status === 'running' ? (
                            <ContainerFileExplorer containerId={container._id} />
                        ) : (
                            <div className="placeholder-state">
                                <Folder size={48} />
                                <Paragraph className="color-muted">Container must be running to browse files</Paragraph>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'settings' && (
                    <div className="content-pane settings-pane">
                        <Title className="font-size-4 font-weight-6">Settings</Title>
                        <div className="settings-card">
                            <div className="card-header">
                                <Title className="font-size-3 font-weight-6">Configuration & Resources</Title>
                                <Paragraph className="color-muted">Update environment variables, ports, and resource limits(CPU/RAM).</Paragraph>
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
                                <Title className="font-size-3 font-weight-6">Delete Container</Title>
                                <Paragraph className="color-muted">Permanently remove this container and all its data.</Paragraph>
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
