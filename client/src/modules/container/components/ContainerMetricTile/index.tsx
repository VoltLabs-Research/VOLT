import Box from '@/shared/presentation/primitives/Box';
import Row from '@/shared/presentation/primitives/Row';
import Sparkline from '@/shared/presentation/primitives/Sparkline';
import StatCard from '@/shared/presentation/primitives/StatCard';
import './ContainerMetricTile.css';

export interface MetricSecondaryStat {
    label: string;
    value: string;
}

export interface ContainerMetricTileProps {
    label: string;
    value: string;
    badge?: string;
    secondary?: MetricSecondaryStat[];
    history: number[];
    color: string;
    isLoading?: boolean;
    idleHint?: string;
}

const SPARKLINE_HEIGHT = 32;

const ContainerMetricTile = ({
    label,
    value,
    badge,
    secondary,
    history,
    color,
    isLoading = false,
    idleHint = 'Idle'
}: ContainerMetricTileProps) => {
    const hasHistory = history.length > 0;
    const stateClass = isLoading || !hasHistory ? 'container-metric-tile--idle' : '';
    const displayValue = hasHistory ? value : idleHint;

    const footer = (
        <>
            <Box className='container-metric-tile-sparkline' aria-hidden='true'>
                <Sparkline
                    color={color}
                    values={history}
                    height={SPARKLINE_HEIGHT}
                    strokeWidth={1.5}
                    fillOpacityStart={0.18}
                    fillOpacityEnd={0}
                    interpolation='monotone'
                    animate={false}
                    minDataMax={1}
                />
            </Box>

            {secondary && secondary.length > 0 && (
                <Row className='container-metric-tile-secondary' wrap>
                    {secondary.map((stat, index) => (
                        <span key={stat.label} className='d-flex items-center'>
                            {index > 0 && <span className='container-metric-tile-secondary-dot' aria-hidden='true'>·</span>}
                            <span>
                                {stat.label} <span className='color-secondary'>{stat.value}</span>
                            </span>
                        </span>
                    ))}
                </Row>
            )}
        </>
    );

    return (
        <StatCard
            className={`container-metric-tile ${stateClass}`}
            label={label}
            value={<span aria-label={`${label} ${displayValue}`}>{displayValue}</span>}
            trend={badge ? <span className='container-metric-tile-badge'>{badge}</span> : undefined}
            footer={footer}
            surface='soft'
            tabular
        />
    );
};

export default ContainerMetricTile;
