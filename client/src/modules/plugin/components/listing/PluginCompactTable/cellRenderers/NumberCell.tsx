import { formatScientific } from '@/modules/plugin/components/listing/PluginCompactTable/formatters';

interface NumberCellProps {
    value: unknown;
}

const NumberCell = ({ value }: NumberCellProps) => {
    if(typeof value !== 'number'){
        if(typeof value === 'bigint'){
            const text = value.toString();
            return <span className='plugin-cell-number tabular-nums' title={text}>{text}</span>;
        }
        return <span className='plugin-cell-empty'>-</span>;
    }

    if(!Number.isFinite(value)){
        return <span className='plugin-cell-empty tabular-nums'>{String(value)}</span>;
    }

    const { short, long } = formatScientific(value, 4);
    const title = short === long ? undefined : long;
    return <span className='plugin-cell-number tabular-nums' title={title}>{short}</span>;
};

export default NumberCell;
