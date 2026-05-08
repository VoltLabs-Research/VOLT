import { Fragment } from 'react';
import { formatScientific, vectorMagnitude, safeJsonStringify } from '@/modules/plugin/components/listing/PluginCompactTable/formatters';
import { resolveNumberArrayCellValue } from '@/modules/plugin/components/listing/PluginCompactTable/cellRenderers/number-array-value';

interface VectorCellProps {
    value: unknown;
}

const VectorCell = ({ value }: VectorCellProps) => {
    const resolved = resolveNumberArrayCellValue(value);
    if ('fallback' in resolved) {
        return resolved.fallback;
    }
    const numbers = resolved.numbers;

    const formatted = numbers.map((component) => formatScientific(component, 3).short);
    const magnitude = vectorMagnitude(numbers);
    const title = `${safeJsonStringify(numbers)}  |v|=${magnitude.toPrecision(6)}`;

    return (
        <span className='plugin-cell-vector tabular-nums' title={title}>
            <span className='plugin-cell-vector__bracket'>⟨</span>
            {formatted.map((component, index) => (
                <Fragment key={index}>
                    {index > 0 && <span className='plugin-cell-vector__sep'>,</span>}
                    <span className='plugin-cell-vector__component'>{component}</span>
                </Fragment>
            ))}
            <span className='plugin-cell-vector__bracket'>⟩</span>
        </span>
    );
};

export default VectorCell;
