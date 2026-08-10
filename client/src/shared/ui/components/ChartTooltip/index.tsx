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
    <div className='rounded-xl border border-border bg-overlay p-3 shadow-lg' role='tooltip'>
        {title && (
            <p className='mb-2 text-sm font-semibold text-foreground'>
                {title}
            </p>
        )}
        <ul className='m-0 pl-4'>
            {items.map((item, index) => (
                <li
                    key={`${item.label}-${index}`}
                    className='my-1 text-xs text-muted'
                    style={item.color ? { color: item.color } : undefined}
                >
                    {item.label}: <strong>{item.value}</strong>
                </li>
            ))}
        </ul>
    </div>
);

export default ChartTooltip;
