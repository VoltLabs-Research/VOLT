import './ChartTooltip.css';

interface ChartTooltipItem {
    label: string;
    value: string | number;
    color?: string;
};

interface ChartTooltipProps {
    title?: string;
    items: ChartTooltipItem[];
};

const ChartTooltip = ({ title, items }: ChartTooltipProps) => (
    <div className='chart-tooltip' role='tooltip'>
        {title && (
            <p className='chart-tooltip-title text-md font-semibold text-primary'>
                {title}
            </p>
        )}
        <ul className='chart-tooltip-list'>
            {items.map((item, index) => (
                <li
                    key={`${item.label}-${index}`}
                    className='chart-tooltip-item text-sm'
                    style={item.color ? { color: item.color } : undefined}
                >
                    {item.label}: <strong>{item.value}</strong>
                </li>
            ))}
        </ul>
    </div>
);

export default ChartTooltip;
