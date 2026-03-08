import './DashboardClusterHealth.css';
import useClusterMetrics from '@/modules/cluster/hooks/use-cluster-metrics';
import Button from '@/shared/presentation/components/Button';
import Container from '@/shared/presentation/components/Container';
import Select from '@/shared/presentation/components/Select';
import StatusBadge from '@/shared/presentation/components/StatusBadge';
import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@mui/material';
import { Cpu, HardDrive, MemoryStick } from 'lucide-react';
import { GoArrowRight } from 'react-icons/go';
import type { ReactNode } from 'react';
import type { SelectOption } from '@/shared/presentation/components/Select';

interface GaugeProps {
    label: string;
    percent: number;
    icon: ReactNode;
    detail: string;
};

const GAUGE_RADIUS = 28;
const GAUGE_STROKE = 4;
const GAUGE_CIRCUMFERENCE = 2 * Math.PI * GAUGE_RADIUS;

const getGaugeColor = (percent: number): string => {
    if (percent >= 90) return 'var(--accent-red)';
    if (percent >= 70) return 'var(--accent-yellow, #f5a623)';
    return 'var(--accent-green)';
};

const GaugeRing = ({ label, percent, icon, detail }: GaugeProps) => {
    const clamped = Math.min(100, Math.max(0, percent));
    const offset = GAUGE_CIRCUMFERENCE - (clamped / 100) * GAUGE_CIRCUMFERENCE;
    const color = getGaugeColor(clamped);

    return (
        <Container className='cluster-gauge d-flex column items-center gap-05'>
            <Container className='cluster-gauge-ring p-relative d-flex flex-center'>
                <svg width={68} height={68} viewBox='0 0 68 68'>
                    <circle
                        cx='34'
                        cy='34'
                        r={GAUGE_RADIUS}
                        fill='none'
                        stroke='var(--color-border-soft)'
                        strokeWidth={GAUGE_STROKE}
                    />
                    <circle
                        cx='34'
                        cy='34'
                        r={GAUGE_RADIUS}
                        fill='none'
                        stroke={color}
                        strokeWidth={GAUGE_STROKE}
                        strokeLinecap='round'
                        strokeDasharray={GAUGE_CIRCUMFERENCE}
                        strokeDashoffset={offset}
                        transform='rotate(-90 34 34)'
                        className='cluster-gauge-progress'
                    />
                </svg>
                <Container className='cluster-gauge-center p-absolute d-flex flex-center'>
                    <span className='font-size-2 font-weight-6 color-primary'>
                        {Math.round(clamped)}%
                    </span>
                </Container>
            </Container>

            <Container className='d-flex items-center gap-025'>
                <span className='cluster-gauge-icon color-muted'>{icon}</span>
                <span className='font-size-1 font-weight-5 color-primary'>{label}</span>
            </Container>
            <span className='font-size-1 color-muted cluster-gauge-detail'>{detail}</span>
        </Container>
    );
};

const statusToVariant = (status: string): string => {
    switch (status) {
        case 'Healthy': return 'ready';
        case 'Warning': return 'processing';
        case 'Critical': return 'failed';
        default: return status.toLowerCase();
    }
};

const DashboardClusterHealth = () => {
    const navigate = useNavigate();
    const {
        metrics,
        clusters,
        selectedClusterId,
        setSelectedClusterId,
        isConnected,
        requestHistory
    } = useClusterMetrics();

    useEffect(() => {
        requestHistory(5);
    }, [requestHistory]);

    const clusterOptions = useMemo<SelectOption[]>(() => {
        if (!clusters.length) {
            return [{ value: 'main-cluster', title: 'Main Cluster' }];
        }
        return clusters.map((cluster) => ({
            value: cluster.clusterId,
            title: cluster.clusterId,
            description: `${cluster.analysisCount ?? 0} analyzes`
        }));
    }, [clusters]);

    const gauges = useMemo(() => {
        if (!metrics) return null;
        return [
            {
                label: 'CPU',
                percent: metrics.cpu.usage,
                icon: <Cpu size={12} strokeWidth={1.8} />,
                detail: `${metrics.cpu.cores} cores`
            },
            {
                label: 'RAM',
                percent: metrics.memory.usagePercent,
                icon: <MemoryStick size={12} strokeWidth={1.8} />,
                detail: `${metrics.memory.used.toFixed(1)} GB / ${metrics.memory.total.toFixed(1)} GB`
            },
            {
                label: 'Disk',
                percent: metrics.disk.usagePercent,
                icon: <HardDrive size={12} strokeWidth={1.8} />,
                detail: `${metrics.disk.free.toFixed(1)} GB free`
            }
        ];
    }, [metrics]);

    if (!isConnected || !metrics) {
        return (
            <Container className='dashboard-cluster-card'>
                <Container className='dashboard-cluster-header'>
                    <Select
                        options={clusterOptions}
                        value={selectedClusterId}
                        onChange={setSelectedClusterId}
                        className='dashboard-cluster-select'
                    />
                </Container>
                <Container className='dashboard-cluster-gauges d-flex items-center content-around flex-1'>
                    {Array.from({ length: 3 }, (_, i) => (
                        <Container key={i} className='d-flex column items-center gap-05'>
                            <Skeleton variant='circular' width={68} height={68} />
                            <Skeleton variant='text' width={40} height={14} />
                            <Skeleton variant='text' width={60} height={12} />
                        </Container>
                    ))}
                </Container>
            </Container>
        );
    }

    return (
        <Container className='dashboard-cluster-card'>
            <Container className='dashboard-cluster-header'>
                <Select
                    options={clusterOptions}
                    value={selectedClusterId}
                    onChange={setSelectedClusterId}
                    className='dashboard-cluster-select'
                />
                <Button
                    variant='ghost'
                    intent='neutral'
                    size='sm'
                    onClick={() => navigate('/dashboard/clusters')}
                    rightIcon={<GoArrowRight size={12} />}
                >
                    View clusters
                </Button>
            </Container>

            <Container className='dashboard-cluster-gauges d-flex items-center content-around flex-1'>
                {gauges!.map((g) => (
                    <GaugeRing
                        key={g.label}
                        label={g.label}
                        percent={g.percent}
                        icon={g.icon}
                        detail={g.detail}
                    />
                ))}
            </Container>

            <Container className='dashboard-cluster-footer'>
                <StatusBadge status={statusToVariant(metrics.status)} size='compact'>
                    {metrics.status}
                </StatusBadge>
            </Container>
        </Container>
    );
};

export default DashboardClusterHealth;
