import { Box, Row, Sparkline, StatCard, Text } from '@voltstack/bravais';
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
                        <Row key={stat.label} as='span' align='center'>
                            {index > 0 && <Text as='span' className='container-metric-tile-secondary-dot' aria-hidden='true'>·</Text>}
                            <Text as='span'>
                                {stat.label} <Text as='span' tone='secondary'>{stat.value}</Text>
                            </Text>
                        </Row>
                    ))}
                </Row>
            )}
        </>
    );

    return (
        <StatCard
            className={`container-metric-tile ${stateClass}`}
            label={label}
            value={<Text as='span' aria-label={`${label} ${displayValue}`}>{displayValue}</Text>}
            trend={badge ? <Text as='span' className='container-metric-tile-badge'>{badge}</Text> : undefined}
            footer={footer}
            surface='soft'
            tabular
        />
    );
};

export default ContainerMetricTile;
