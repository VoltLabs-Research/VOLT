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
import Button from '@/components/primitives/Button';
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
        <div className="details-page-layout d-flex overflow-hidden">
            <div className="details-sidebar d-flex column f-shrink-0">
                <div className="sidebar-header-details">
                    <Button variant='ghost' intent='neutral' size='sm' leftIcon={<ArrowLeft size={16} />} onClick={() => navigate('/dashboard/containers')}>Back</Button>
                    <div className="d-flex items-center gap-1 container-identity">
                        <div className="d-flex items-center content-center container-icon-large">
                            <Box size={24} />
                        </div>
                        <div className="identity-text">
                            <Title className="font-size-4 font-weight-6">{container.name}</Title>
                            <span className={`d-flex items-center gap-035 status-badge ${container.status} font-size-1 font-weight-5 font-weight-6`}>{container.status}</span>
                        </div>
                    </div>
                </div>

                <nav className="sidebar-nav d-flex column gap-025 flex-1">
                    <Button
                        variant={activeTab === 'overview' ? 'soft' : 'ghost'}
                        intent={activeTab === 'overview' ? 'brand' : 'neutral'}
                        size='sm'
                        block
                        align='start'
                        leftIcon={<Layers size={18} />}
                        onClick={() => setActiveTab('overview')}
                    >Overview</Button>
                    <Button
                        variant={activeTab === 'processes' ? 'soft' : 'ghost'}
                        intent={activeTab === 'processes' ? 'brand' : 'neutral'}
                        size='sm'
                        block
                        align='start'
                        leftIcon={<Activity size={18} />}
                        onClick={() => setActiveTab('processes')}
                    >Processes</Button>
                    <Button
                        variant={activeTab === 'logs' ? 'soft' : 'ghost'}
                        intent={activeTab === 'logs' ? 'brand' : 'neutral'}
                        size='sm'
                        block
                        align='start'
                        leftIcon={<Terminal size={18} />}
                        onClick={() => setActiveTab('logs')}
                    >Terminal & Logs</Button>
                    <Button
                        variant={activeTab === 'storage' ? 'soft' : 'ghost'}
                        intent={activeTab === 'storage' ? 'brand' : 'neutral'}
                        size='sm'
                        block
                        align='start'
                        leftIcon={<Folder size={18} />}
                        onClick={() => setActiveTab('storage')}
                    >Files & Storage</Button>
                    <Button
                        variant={activeTab === 'settings' ? 'soft' : 'ghost'}
                        intent={activeTab === 'settings' ? 'brand' : 'neutral'}
                        size='sm'
                        block
                        align='start'
                        leftIcon={<Settings size={18} />}
                        onClick={() => setActiveTab('settings')}
                    >Settings</Button>
                </nav>

                <div className="sidebar-actions d-flex column gap-075">
                    {container.status !== 'running' ? (
                        <Button variant='solid' intent='success' block leftIcon={<Play size={16} />} onClick={() => handleAction('start')} disabled={actionLoading}>Start Container</Button>
                    ) : (
                        <>
                            <Button variant='outline' intent='neutral' block leftIcon={<RefreshCw size={16} />} onClick={() => handleAction('restart')} disabled={actionLoading}>Restart</Button>
                            <Button variant='soft' intent='danger' block leftIcon={<Square size={16} />} onClick={() => handleAction('stop')} disabled={actionLoading}>Stop</Button>
                        </>
                    )}
                    {container.ports?.[0] && (
                        <a href={`http://localhost:${container.ports[0].public}`} target="_blank" rel="noopener noreferrer" className="d-flex items-center content-center gap-05 visit-btn font-size-2 font-weight-6">
                            Visit App <ExternalLink size={14} />
                        </a>
                    )}
                </div>
            </div>

            <div className="details-content-area y-auto flex-1">
                {activeTab === 'overview' && (
                    <div className="content-pane d-flex column gap-2 h-max">
                        <div className="d-flex content-between pane-header">
                            <Title className="font-size-4 font-weight-6">Overview</Title>
                            <div className="d-flex gap-075 meta-tags">
                                <span className="d-flex items-center gap-05 tag monospace font-size-1 font-weight-5 color-muted-foreground">ID: {container.containerId.substring(0, 12)}</span>
                                <span className="d-flex items-center gap-05 tag font-size-1 font-weight-5 color-muted-foreground">Image: {container.image}</span>
                                <span className="d-flex items-center gap-05 tag font-size-1 font-weight-5 color-muted-foreground">Created: {new Date(container.createdAt).toLocaleDateString()}</span>
                            </div>
                        </div>

                        <div className="stats-grid gap-2">
                            <div className="stat-card">
                                <div className="d-flex content-between items-center card-header-row mb-1-5">
                                    <Title className="font-size-3 font-weight-6">CPU Usage</Title>
                                    <span className="limit-badge font-size-1 font-weight-6">Limit: {container.cpus || 1} vCPU</span>
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
                                <div className="d-flex content-between items-center card-header-row mb-1-5">
                                    <Title className="font-size-3 font-weight-6">Memory Usage</Title>
                                    <span className="limit-badge font-size-1 font-weight-6">Limit: {container.memory || 512} MB</span>
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

                        <div className="config-grid gap-2">
                            <div className="config-card">
                                <Title className="d-flex items-center gap-05 font-size-3 font-weight-6">Environment Variables</Title>
                                <div className="env-list d-flex column gap-075">
                                    {container.env && container.env.length > 0 ? (
                                        container.env.map((e: any, i: number) => (
                                            <div key={i} className="d-flex content-between env-row">
                                                <span className="env-key font-weight-6">{e.key}</span>
                                                <span className="env-val color-muted-foreground">{e.value}</span>
                                            </div>
                                        ))
                                    ) : (
                                        <Paragraph className="color-muted font-size-2">No environment variables</Paragraph>
                                    )}
                                </div>
                            </div>
                            <div className="config-card">
                                <Title className="d-flex items-center gap-05 font-size-3 font-weight-6">Port Bindings</Title>
                                <div className="port-list d-flex column gap-075">
                                    {container.ports && container.ports.length > 0 ? (
                                        container.ports.map((p: any, i: number) => (
                                            <div key={i} className="d-flex content-between port-row">
                                                <span className="port-private font-weight-6">{p.private}/tcp</span>
                                                <span className="arrow color-muted-foreground">→</span>
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
                    <div className="content-pane full-height h-max">
                        {container.status === 'running' ? (
                            <ContainerProcesses containerId={container._id} />
                        ) : (
                            <div className="placeholder-state d-flex column items-center content-center gap-1-5 h-max color-muted-foreground">
                                <Activity size={48} />
                                <Paragraph className="color-muted">Container must be running to view processes</Paragraph>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'logs' && (
                    <div className="content-pane full-height h-max">
                        {container.status === 'running' ? (
                            <ContainerTerminal
                                container={container}
                                onClose={() => { }}
                                embedded={true}
                            />
                        ) : (
                            <div className="placeholder-state d-flex column items-center content-center gap-1-5 h-max color-muted-foreground">
                                <Terminal size={48} />
                                <Paragraph className="color-muted">Container must be running to view logs</Paragraph>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'storage' && (
                    <div className="content-pane full-height h-max">
                        {container.status === 'running' ? (
                            <ContainerFileExplorer containerId={container._id} />
                        ) : (
                            <div className="placeholder-state d-flex column items-center content-center gap-1-5 h-max color-muted-foreground">
                                <Folder size={48} />
                                <Paragraph className="color-muted">Container must be running to browse files</Paragraph>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'settings' && (
                    <div className="content-pane settings-pane h-max">
                        <Title className="font-size-4 font-weight-6">Settings</Title>
                        <div className="container-settings-card overflow-hidden">
                            <div className="card-header">
                                <Title className="font-size-3 font-weight-6">Configuration & Resources</Title>
                                <Paragraph className="color-muted">Update environment variables, ports, and resource limits(CPU/RAM).</Paragraph>
                            </div>
                            <div className="d-flex content-end card-body">
                                <Button
                                    variant='outline'
                                    intent='neutral'
                                    leftIcon={<Settings size={16} />}
                                    onClick={() => (document.getElementById('edit-container-modal') as HTMLDialogElement)?.showModal()}
                                >
                                    Edit Configuration
                                </Button>
                            </div>
                        </div>

                        <div className="container-settings-card danger overflow-hidden">
                            <div className="card-header">
                                <Title className="font-size-3 font-weight-6">Delete Container</Title>
                                <Paragraph className="color-muted">Permanently remove this container and all its data.</Paragraph>
                            </div>
                            <div className="d-flex content-end card-body">
                                <Button
                                    variant='solid'
                                    intent='danger'
                                    leftIcon={<Trash2 size={16} />}
                                    onClick={() => handleAction('delete')}
                                >
                                    Delete Container
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <EditContainerModal
                container={container}
                onSuccess={fetchContainer}
            />
        </div>
    );
};

export default ContainerDetails;
