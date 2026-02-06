import { memo } from 'react';
import usePerformanceMonitor from '@/modules/canvas/presentation/hooks/use-performance-monitor';
import WidgetContainer from '@/modules/canvas/presentation/components/atoms/WidgetContainer';
import ModifierHeader from '@/modules/canvas/presentation/components/atoms/ModifierHeader';
import Container from '@/shared/presentation/components/Container';
import { formatNumber } from '@/shared/utils/format';
import '@/modules/canvas/presentation/components/organisms/PerformanceMonitor/PerformanceMonitor.css';

interface PerformanceMonitorProps {
    trajectoryId?: string;
    analysisId?: string;
    currentTimestep?: number;
}

const StatItem = memo(({ label, value }: { label: string; value: string | number }) => (
    <>
        <span className='color-muted font-size-1'>{label}</span>
        <span className='color-secondary font-size-1 font-weight-5'>{value}</span>
    </>
));
StatItem.displayName = 'StatItem';

const PerformanceMonitor = memo(({ currentTimestep: propTimestep }: PerformanceMonitorProps) => {
    const { stats, atomCount, currentTimestep } = usePerformanceMonitor({ currentTimestep: propTimestep });

    const statItems = [
        { label: 'Atoms', value: formatNumber(atomCount) },
        { label: 'Timestep', value: currentTimestep ?? '-' },
        { label: 'FPS', value: stats.fps.toFixed(0) },
        { label: 'Frame', value: `${stats.frameTime.toFixed(1)}ms` },
        { label: 'Geometries', value: stats.memory.geometries },
        { label: 'Textures', value: stats.memory.textures },
        { label: 'Draw Calls', value: formatNumber(stats.render.calls) },
        { label: 'Triangles', value: formatNumber(stats.render.triangles) }
    ];

    return (
        <WidgetContainer className='perf-monitor-container p-1 d-flex column gap-1'>
            <ModifierHeader title='Performance' modifierId='performance-monitor' />
            <Container className='perf-monitor-grid'>
                {statItems.map((item) => (
                    <StatItem key={item.label} label={item.label} value={item.value} />
                ))}
            </Container>
        </WidgetContainer>
    );
});

PerformanceMonitor.displayName = 'PerformanceMonitor';

export default PerformanceMonitor;
