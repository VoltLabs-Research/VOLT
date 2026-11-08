import { formatMetric, toFiniteNumber } from '@/modules/analysis/utils/run-results';
import { cn } from '@heroui/react';
import { useEffect, useRef } from 'react';
import type { RunSeries } from '@/modules/analysis/utils/run-results';
import Scrollable from '@/shared/ui/components/Scrollable';

interface ReportDataTableProps {
    series: RunSeries;
    index: number;
    onIndexChange: (index: number) => void;
    failedTimesteps: ReadonlySet<number>;
}

/* Every row of the run's listing; the current frame is highlighted and a click moves to it. */
const ReportDataTable = ({ series, index, onIndexChange, failedTimesteps }: ReportDataTableProps) => {
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const container = scrollRef.current;
        const row = container?.querySelector<HTMLElement>(`[data-row-index="${index}"]`);
        if (!container || !row) return;
        if (row.offsetTop < container.scrollTop + 36 || row.offsetTop > container.scrollTop + container.clientHeight - 36) {
            container.scrollTop = row.offsetTop - container.clientHeight / 2;
        }
    }, [index]);

    // The header sits outside the scrolling body, so the body's edge fade never washes it out.
    // Both tables share one fixed column layout to stay aligned.
    const columns = (
        <colgroup>
            <col />
            {series.metrics.map((metric) => <col key={metric.key} />)}
        </colgroup>
    );

    return (
        <div className='flex flex-col'>
            <table className='w-full table-fixed border-collapse text-xs tabular-nums'>
                {columns}
                <thead>
                    <tr>
                        <th className='truncate px-2.5 py-2 text-left font-medium text-muted'>Timestep</th>
                        {series.metrics.map((metric) => (
                            <th key={metric.key} title={metric.key} className='truncate px-2.5 py-2 text-right font-medium text-muted'>{metric.label}</th>
                        ))}
                    </tr>
                </thead>
            </table>
            <Scrollable ref={scrollRef} className='max-h-[360px]'>
            <table className='w-full table-fixed border-collapse text-xs tabular-nums'>
                {columns}
                <tbody>
                    {series.timesteps.map((timestep, position) => {
                        const row = series.rows[position];
                        const failed = failedTimesteps.has(timestep);
                        return (
                            <tr
                                key={timestep}
                                data-row-index={position}
                                onClick={() => onIndexChange(position)}
                                className={cn('cursor-pointer border-t border-border hover:bg-foreground/[0.045]', position === index && 'bg-foreground/[0.08] font-medium')}
                            >
                                <td className='px-2.5 py-2'>{timestep.toLocaleString('en-US')}</td>
                                {failed && Object.keys(row).length === 0
                                    ? <td colSpan={series.metrics.length} className='px-2.5 py-2 text-danger'>Failed</td>
                                    : series.metrics.map((metric) => (
                                        <td key={metric.key} className='px-2.5 py-2 text-right'>{formatMetric(toFiniteNumber(row[metric.key]))}</td>
                                    ))}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
            </Scrollable>
        </div>
    );
};

export default ReportDataTable;
