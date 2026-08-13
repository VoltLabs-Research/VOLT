import ResourceSparkline from './ResourceSparkline';
import { formatNetworkSpeedWithUnit } from '@/modules/cluster/utils/format-network';
import { getClusterCpuUsage } from '@/modules/cluster/utils/cluster-cpu-usage';
import { Skeleton } from '@heroui/react';
import type { ClusterMetrics } from '@volt/contracts/modules/cluster/domain';

const LOADING_ROW_KEYS = ['readout-0', 'readout-1', 'readout-2', 'readout-3'];

const WARNING_THRESHOLD_PERCENT = 60;
const DANGER_THRESHOLD_PERCENT = 80;

interface ReadoutRow {
    name: string;
    /** Already formatted, unit included. */
    value: string;
    detail: string;
    history: number[];
    /** Absent for measures with no capacity to be a share of, such as throughput. */
    percentage?: number;
}

/*
 * Colour returns here as an ordinal reading of one number — how close to full — and it
 * is redundant with the percentage printed beside it, so it is never the only carrier
 * of the meaning. That is different from the per-core chart below, where colour was
 * being asked to identify 160 series and could not.
 */
const toneFor = (percentage: number | undefined): string => {
    if (percentage === undefined) return 'var(--accent)';
    if (percentage >= DANGER_THRESHOLD_PERCENT) return 'var(--danger)';
    if (percentage >= WARNING_THRESHOLD_PERCENT) return 'var(--warning)';
    return 'var(--success)';
};

/*
 * One surface, one row per measure, replacing the three summary cards and the separate
 * Resource Usage panel.
 *
 * Those were four bordered boxes describing three measures between them: CPU was a
 * card, a bar and a chart average; memory and disk each appeared as both a card and a
 * bar. Here every measure is stated once — name, current value, the facts behind it,
 * and its own recent shape — and the panels below stay for the measures that split
 * into series worth reading over time (per-core load, rx/tx, read/write).
 *
 * The sparkline also does what the old segmented bar only implied: the bar filled to a
 * percentage in 40 steps, which looked like history and was not.
 */
const ClusterResourceReadout = ({
    metrics,
    history
}: {
    metrics: ClusterMetrics | null;
    history: ClusterMetrics[];
}) => {
    if (!metrics) {
        return (
            <div className='divide-y divide-border rounded-xl border border-border'>
                {LOADING_ROW_KEYS.map((key) => (
                    <div className='flex flex-row items-center gap-6 px-6 py-4' key={key}>
                        <Skeleton animationType='pulse' className='h-4 w-40 rounded-md' />
                        <span className='flex-1' />
                        <Skeleton animationType='pulse' className='h-4 w-16 rounded-md' />
                    </div>
                ))}
            </div>
        );
    }

    const cpuUsage = getClusterCpuUsage(metrics.cpu);
    const networkTotal = metrics.network.incoming + metrics.network.outgoing;
    const networkFormatted = formatNetworkSpeedWithUnit(networkTotal);
    const outgoing = formatNetworkSpeedWithUnit(metrics.network.outgoing);
    const incoming = formatNetworkSpeedWithUnit(metrics.network.incoming);

    const rows: ReadoutRow[] = [
        {
            name: 'CPU',
            value: `${cpuUsage.toFixed(1)}%`,
            detail: `${metrics.cpu.cores} cores · load ${metrics.cpu.loadAvg[0].toFixed(2)}`,
            percentage: cpuUsage,
            history: history.map((point) => getClusterCpuUsage(point.cpu))
        },
        {
            name: 'Memory',
            value: `${metrics.memory.usagePercent}%`,
            detail: `${metrics.memory.used.toFixed(1)} GB of ${metrics.memory.total.toFixed(1)} GB · ${metrics.memory.free.toFixed(1)} GB available`,
            percentage: metrics.memory.usagePercent,
            history: history.map((point) => point.memory.usagePercent)
        },
        {
            name: 'Disk',
            value: `${metrics.disk.usagePercent}%`,
            detail: `${metrics.disk.used.toFixed(1)} GB of ${metrics.disk.total.toFixed(1)} GB · ${metrics.disk.free.toFixed(1)} GB free`,
            percentage: metrics.disk.usagePercent,
            history: history.map((point) => point.disk.usagePercent)
        },
        {
            /*
             * No percentage: throughput has no capacity to be a share of. The old bar
             * showed it as a percentage of a 10 MB/s ceiling that exists nowhere, so it
             * filled at a rate unrelated to any limit.
             */
            name: 'Network',
            value: `${networkFormatted.value} ${networkFormatted.unit}`,
            detail: `↑ ${outgoing.value} ${outgoing.unit} · ↓ ${incoming.value} ${incoming.unit}`,
            history: history.map((point) => point.network.incoming + point.network.outgoing)
        }
    ];

    return (
        <div className='divide-y divide-border rounded-xl border border-border'>
            {rows.map((row) => {
                const tone = toneFor(row.percentage);

                return (
                    <div
                        className='flex flex-row items-center gap-4 px-6 py-4 max-md:flex-wrap max-md:gap-y-2 md:gap-6'
                        key={row.name}
                    >
                        <div className='flex min-w-0 flex-col gap-0.5 md:w-64 md:shrink-0'>
                            <span className='text-sm font-medium text-foreground'>{row.name}</span>
                            <span className='truncate text-xs text-muted tabular-nums'>{row.detail}</span>
                        </div>

                        {/* Sits between the name and the value so all four traces share one column. */}
                        <div className='min-w-24 flex-1 max-md:order-last max-md:w-full max-md:flex-none'>
                            <ResourceSparkline values={row.history} color={tone} />
                        </div>

                        <span
                            className='shrink-0 text-xl font-medium leading-none tabular-nums md:w-28 md:text-right'
                            style={{ color: tone }}
                        >
                            {row.value}
                        </span>
                    </div>
                );
            })}
        </div>
    );
};

export default ClusterResourceReadout;
