import Scrollable from '@/shared/ui/components/Scrollable';

interface EndpointsBarChartDatum {
    endpoint: string;
    count: number;
}

interface EndpointsBarChartProps {
    data: EndpointsBarChartDatum[];
    height: number;
}

// Ranked bars rather than a chart: each endpoint reads in full, with its count beside it.
const EndpointsBarChart = ({ data, height }: EndpointsBarChartProps) => {
    const max = Math.max(1, ...data.map((entry) => entry.count));

    return (
        <Scrollable style={{ maxHeight: height }}>
            <ol className='flex flex-col gap-3.5'>
                {data.map((entry) => (
                    <li className='grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 text-sm' key={entry.endpoint}>
                        <span className='truncate font-mono text-foreground' title={entry.endpoint}>{entry.endpoint}</span>
                        <span className='tabular-nums text-muted'>{entry.count.toLocaleString()}</span>
                        <span className='col-span-full h-1.5 overflow-hidden rounded-full bg-foreground/6' aria-hidden='true'>
                            <span className='block h-full rounded-full bg-foreground' style={{ width: `${(entry.count / max) * 100}%` }} />
                        </span>
                    </li>
                ))}
            </ol>
        </Scrollable>
    );
};

export default EndpointsBarChart;
