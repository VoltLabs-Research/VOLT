import { Box } from '@/shared/presentation/primitives';

interface MetricBarsProps {
    percentage: number;
};

const MetricBars = ({ percentage }: MetricBarsProps) => {
    const activeBars = Math.floor(percentage / 20);

    return (
        <Box display='flex' className='gap-01'>
            {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className={`server-table-bar ${i < activeBars ? 'server-table-bar-active' : ''}`} />
            ))}
        </Box>
    );
};

export default MetricBars;
