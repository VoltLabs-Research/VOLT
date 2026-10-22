import { Skeleton } from '@heroui/react';
import type { ReactNode } from 'react';

type ChartStatEmphasis = 'primary' | 'secondary';

export interface ChartStat {
    label: string;
    value: string | number;
    emphasis?: ChartStatEmphasis;
};

interface ChartContainerProps {
    title: string;
    isLoading: boolean;
    children: ReactNode;
    stats?: ChartStat[];
    statsLoading?: boolean;
};

const ChartContainer = ({
    title,
    isLoading,
    children,
    stats,
    statsLoading = false
}: ChartContainerProps) => {
    const renderStat = (stat: ChartStat) => {
        const emphasis: ChartStatEmphasis = stat.emphasis ?? 'secondary';

        return (
            <div className='flex flex-col gap-1' key={stat.label}>
                <dt className='text-2xs font-semibold uppercase leading-none tracking-[0.05em] text-muted'>
                    {stat.label}
                </dt>
                <dd className='m-0'>
                    {statsLoading ? (
                        <Skeleton className={{ primary: 'h-7 w-20 rounded-md', secondary: 'h-4 w-12 rounded-md' }[emphasis]} />
                    ) : (
                        <span className={{
                            primary: 'tabular-nums lining-nums text-2xl font-semibold leading-none tracking-[-0.02em] text-foreground',
                            secondary: 'tabular-nums lining-nums text-base font-medium leading-tight text-muted'
                        }[emphasis]}>
                            {stat.value}
                        </span>
                    )}
                </dd>
            </div>
        );
    };

    // The mockup's chart card: a tile on the page, its title and figures above the chart.
    return (
        <section className='flex h-full max-h-[400px] min-w-0 flex-col gap-6 rounded-2xl bg-foreground/4 p-6 max-sm:p-5'>
            <div className='flex flex-wrap items-start justify-between gap-x-6 gap-y-3'>
                <h3 className='text-base font-semibold text-foreground'>
                    {title}
                </h3>
                {stats && (
                    <dl className='m-0 flex flex-row flex-wrap items-end gap-x-6 gap-y-2'>
                        {stats.map(renderStat)}
                    </dl>
                )}
            </div>

            {isLoading ? (
                <Skeleton className='h-70 w-full rounded-2xl' />
            ) : (
                children
            )}
        </section>
    );
};

export default ChartContainer;
