import { Fragment } from 'react';
import { formatScientific, vectorMagnitude, safeJsonStringify } from '@/modules/plugin/components/listing/PluginCompactTable/formatters';

interface VectorCellProps {
    value: unknown;
}

const isNumberArray = (input: unknown): input is number[] => {
    return Array.isArray(input) && input.every((entry) => typeof entry === 'number');
};

const VectorCell = ({ value }: VectorCellProps) => {
    if(!isNumberArray(value)){
        return <span className='plugin-cell-empty'>-</span>;
    }

    if(value.length === 0){
        return <span className='plugin-cell-empty'>[]</span>;
    }

    const formatted = value.map((component) => formatScientific(component, 3).short);
    const magnitude = vectorMagnitude(value);
    const title = `${safeJsonStringify(value)}  |v|=${magnitude.toPrecision(6)}`;

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
