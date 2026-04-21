interface MetricBarsProps {
    percentage: number;
};

const MetricBars = ({ percentage }: MetricBarsProps) => {
    const activeBars = Math.floor(percentage / 20);

    return (
        <div className='volt-container d-flex gap-01'>
            {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className={`volt-container server-table-bar ${i < activeBars ? 'server-table-bar-active' : ''}`} />
            ))}
        </div>
    );
};

export default MetricBars;
