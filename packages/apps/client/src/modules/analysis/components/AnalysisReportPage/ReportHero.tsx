import LineChart from '@/modules/analysis/components/charts/LineChart';
import { formatMetric, seriesValues } from '@/modules/analysis/utils/run-results';
import { ToggleButton, ToggleButtonGroup } from '@heroui/react';
import { useMemo } from 'react';
import type { RunMetric, RunSeries } from '@/modules/analysis/utils/run-results';
import type { Key } from 'react';

interface ReportHeroProps {
    series: RunSeries;
    metrics: RunMetric[];
    metricKey: string;
    onMetricChange: (key: string) => void;
    index: number;
    onIndexChange: (index: number) => void;
}

const formatTimestep = (value: number): string => (value >= 1000 ? `${(value / 1000).toLocaleString('en-US', { maximumFractionDigits: 1 })}k` : String(value));

/* Apple Health's detail view: the value at the current frame, how it moved since frame 0, then its chart. */
const ReportHero = ({ series, metrics, metricKey, onMetricChange, index, onIndexChange }: ReportHeroProps) => {
    const metric = metrics.find((entry) => entry.key === metricKey) ?? metrics[0];
    const values = useMemo(() => (metric ? seriesValues(series, metric.key) : []), [series, metric]);
    const value = values[index] ?? null;
    const first = values.find((entry) => entry !== null) ?? null;

    let delta: string | null = null;
    if (index > 0 && value !== null && first !== null) {
        const change = value - first;
        const sign = change >= 0 ? '+' : '−';
        delta = first !== 0
            ? `${sign}${Math.abs((change / first) * 100).toFixed(0)}% since frame 0`
            : `${sign}${formatMetric(Math.abs(change))} since frame 0`;
    }

    if (!metric) return null;

    return (
        <section aria-label={metric.label} className='mt-6'>
            <div className='mb-2 flex flex-wrap items-end justify-between gap-4'>
                <div className='min-w-0'>
                    <div className='text-5xl font-light leading-[1.05] tracking-[-0.025em] tabular-nums text-foreground'>{formatMetric(value)}</div>
                    <div className='mt-2 flex flex-wrap items-center gap-2 text-sm text-muted'>
                        <span>{metric.label}</span>
                        {series.timesteps.length > 1 && <span>· frame {index}</span>}
                        {delta && <span className='text-muted/80'>{delta}</span>}
                    </div>
                </div>
                {metrics.length > 1 && (
                    <ToggleButtonGroup
                        selectionMode='single'
                        disallowEmptySelection
                        selectedKeys={[metric.key]}
                        onSelectionChange={(keys) => {
                            const next = [...(keys as Set<Key>)][0];
                            if (typeof next === 'string') onMetricChange(next);
                        }}
                        aria-label='Metric'
                    >
                        {metrics.map((entry) => (
                            <ToggleButton key={entry.key} id={entry.key} variant='ghost'>{entry.label}</ToggleButton>
                        ))}
                    </ToggleButtonGroup>
                )}
            </div>
            {series.timesteps.length > 1 && (
                <LineChart
                    xs={series.timesteps}
                    values={values}
                    color='var(--info)'
                    ariaLabel={`${metric.label} by timestep`}
                    formatX={formatTimestep}
                    formatY={formatMetric}
                    formatValue={formatMetric}
                    formatCaption={(position) => `frame ${position}`}
                    mark={index}
                    onPick={onIndexChange}
                />
            )}
        </section>
    );
};

export default ReportHero;
