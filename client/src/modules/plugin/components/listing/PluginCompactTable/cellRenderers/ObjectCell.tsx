import { Fragment } from 'react';
import { summarizeScalar, safeJsonStringify } from '@/modules/plugin/components/listing/PluginCompactTable/formatters';

interface ObjectCellProps {
    value: unknown;
};

const MAX_SUMMARY_KEYS = 2;

const ObjectCell = ({ value }: ObjectCellProps) => {
    if(value === null || typeof value !== 'object' || Array.isArray(value)){
        return <span className='plugin-cell-empty'>-</span>;
    }

    const entries = Object.entries(value as Record<string, unknown>);
    if(entries.length === 0){
        return <span className='plugin-cell-empty'>{'{}'}</span>;
    }

    const visible = entries.slice(0, MAX_SUMMARY_KEYS);
    const overflow = entries.length - visible.length;
    const title = safeJsonStringify(value);

    return (
        <span className='plugin-cell-object' title={title}>
            <span className='plugin-cell-object__brace'>{'{'}</span>
            {visible.map(([key, raw], index) => (
                <Fragment key={key}>
                    {index > 0 && <span className='plugin-cell-object__sep'>,</span>}
                    <span className='plugin-cell-object__key'>{key}</span>
                    <span className='plugin-cell-object__colon'>:</span>
                    <span className='plugin-cell-object__value tabular-nums'>{summarizeScalar(raw)}</span>
                </Fragment>
            ))}
            {overflow > 0 && <span className='plugin-cell-object__overflow'>, +{overflow}</span>}
            <span className='plugin-cell-object__brace'>{'}'}</span>
        </span>
    );
};

export default ObjectCell;
