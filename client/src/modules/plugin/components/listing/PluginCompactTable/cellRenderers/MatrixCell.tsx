import { safeJsonStringify } from '@/modules/plugin/components/listing/PluginCompactTable/formatters';

interface MatrixCellProps {
    value: unknown;
};

const isMatrix = (input: unknown): input is number[][] => {
    if(!Array.isArray(input)) return false;
    for(const entry of input){
        if(!Array.isArray(entry)) return false;
        for(const cell of entry){
            if(typeof cell !== 'number') return false;
        }
    }
    return true;
};

const MatrixCell = ({ value }: MatrixCellProps) => {
    if(!isMatrix(value)){
        return <span className='plugin-cell-empty'>-</span>;
    }

    if(value.length === 0){
        return <span className='plugin-cell-empty'>[]</span>;
    }

    const rows = value.length;
    const cols = value.reduce((acc, row) => Math.max(acc, row.length), 0);

    return (
        <span className='plugin-cell-matrix tabular-nums' title={safeJsonStringify(value)}>
            <span className='plugin-cell-matrix__dims'>{rows}×{cols}</span>
            <span className='plugin-cell-matrix__label'>matrix</span>
        </span>
    );
};

export default MatrixCell;
