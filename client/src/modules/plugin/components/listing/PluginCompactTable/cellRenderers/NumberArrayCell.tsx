import { formatScientific, safeJsonStringify } from '@/modules/plugin/components/listing/PluginCompactTable/formatters';
import { resolveNumberArrayCellValue } from '@/modules/plugin/components/listing/PluginCompactTable/cellRenderers/number-array-value';

interface NumberArrayCellProps {
    value: unknown;
}

const NumberArrayCell = ({ value }: NumberArrayCellProps) => {
    const resolved = resolveNumberArrayCellValue(value);
    if ('fallback' in resolved) {
        return resolved.fallback;
    }
    const numbers = resolved.numbers;

    let min = numbers[0];
    let max = numbers[0];
    for(const entry of numbers){
        if(entry < min) min = entry;
        if(entry > max) max = entry;
    }

    return (
        <span className='plugin-cell-array tabular-nums' title={safeJsonStringify(numbers)}>
            <span className='plugin-cell-array__count'>[{numbers.length}]</span>
            <span className='plugin-cell-array__range'>
                {formatScientific(min, 3).short} … {formatScientific(max, 3).short}
            </span>
        </span>
    );
};

export default NumberArrayCell;
