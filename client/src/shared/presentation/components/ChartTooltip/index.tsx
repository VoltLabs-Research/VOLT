import './ChartTooltip.css';

export interface ChartTooltipItem {
    label: string;
    value: string | number;
    color?: string;
};

interface ChartTooltipProps {
    title?: string;
    items: ChartTooltipItem[];
};

const ChartTooltip = ({ title, items }: ChartTooltipProps) => (
    <div className='volt-container chart-tooltip' role='tooltip'>
        {title && (
            <p className='volt-text chart-tooltip-title font-size-2 font-weight-6 color-primary'>
                {title}
            </p>
        )}
        <ul className='chart-tooltip-list'>
            {items.map((item, index) => (
                <li
                    key={`${item.label}-${index}`}
                    className='chart-tooltip-item font-size-1'
                    style={item.color ? { color: item.color } : undefined}
                >
                    {item.label}: <strong>{item.value}</strong>
                </li>
            ))}
        </ul>
    </div>
);

export default ChartTooltip;
