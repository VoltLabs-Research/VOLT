interface ChartTooltipItem {
    label: string;
    value: string | number;
    color?: string;
};

interface ChartTooltipProps {
    title?: string;
    items: ChartTooltipItem[];
};

// The mockup's chart tip: a 12px glass card, each series a short key line, its value and name.
const ChartTooltip = ({ title, items }: ChartTooltipProps) => (
    <div className='glass-surface min-w-32 rounded-xl bg-overlay px-2.5 py-2 text-xs shadow-overlay' role='tooltip'>
        {title && (
            <p className='mb-1 text-muted'>
                {title}
            </p>
        )}
        <ul className='m-0 flex list-none flex-col gap-0.5 p-0'>
            {items.map((item, index) => (
                <li key={`${item.label}-${index}`} className='flex items-center gap-2 whitespace-nowrap'>
                    <span
                        className='h-0.5 w-3 shrink-0 rounded-sm bg-foreground'
                        style={item.color ? { backgroundColor: item.color } : undefined}
                        aria-hidden='true'
                    />
                    <b className='font-semibold tabular-nums text-foreground'>{item.value}</b>
                    <span className='text-muted'>{item.label}</span>
                </li>
            ))}
        </ul>
    </div>
);

export default ChartTooltip;
