import { Sparkline, StatCard } from '@voltstack/bravais';
import './ContainerMetricTile.css';

interface MetricSecondaryStat {
    label: string;
    value: string;
}

interface ContainerMetricTileProps {
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
            <div className='container-metric-tile-sparkline' aria-hidden='true'>
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
            </div>

            {secondary && secondary.length > 0 && (
                <div className='flex flex-row items-center flex-wrap container-metric-tile-secondary'>
                    {secondary.map((stat, index) => (
                        <span className='flex flex-row items-center' key={stat.label}>
                            {index > 0 && <span className='container-metric-tile-secondary-dot' aria-hidden='true'>·</span>}
                            <span>
                                {stat.label} <span className='text-muted'>{stat.value}</span>
                            </span>
                        </span>
                    ))}
                </div>
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
