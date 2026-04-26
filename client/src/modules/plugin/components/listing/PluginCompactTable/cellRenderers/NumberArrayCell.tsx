import { formatScientific, safeJsonStringify } from '@/modules/plugin/components/listing/PluginCompactTable/formatters';

interface NumberArrayCellProps {
    value: unknown;
};

const isNumberArray = (input: unknown): input is number[] => {
    return Array.isArray(input) && input.every((entry) => typeof entry === 'number');
};

const NumberArrayCell = ({ value }: NumberArrayCellProps) => {
    if(!isNumberArray(value)){
        return <span className='plugin-cell-empty'>-</span>;
    }

    if(value.length === 0){
        return <span className='plugin-cell-empty'>[]</span>;
    }

    let min = value[0];
    let max = value[0];
    for(const entry of value){
        if(entry < min) min = entry;
        if(entry > max) max = entry;
    }

    return (
        <span className='plugin-cell-array tabular-nums' title={safeJsonStringify(value)}>
            <span className='plugin-cell-array__count'>[{value.length}]</span>
            <span className='plugin-cell-array__range'>
                {formatScientific(min, 3).short} … {formatScientific(max, 3).short}
            </span>
        </span>
    );
};

export default NumberArrayCell;
