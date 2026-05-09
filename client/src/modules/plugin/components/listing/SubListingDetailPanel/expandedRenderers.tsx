import { Fragment, type ReactNode } from 'react';
import { inferCellKind } from '@/modules/plugin/components/listing/PluginCompactTable/typeInference';
import { formatScientific, vectorMagnitude } from '@/modules/plugin/components/listing/PluginCompactTable/formatters';

const NUMERIC_PRECISION = 8;
const MAX_ARRAY_ROWS = 500;

const isNumberArray = (input: unknown): input is number[] => {
    return Array.isArray(input) && input.every((entry) => typeof entry === 'number');
};

const isNumberMatrix = (input: unknown): input is number[][] => {
    if(!Array.isArray(input)) return false;
    for(const row of input){
        if(!Array.isArray(row)) return false;
        for(const cell of row){
            if(typeof cell !== 'number') return false;
        }
    }
    return true;
};

const DIMENSION_LABELS = ['x', 'y', 'z', 'w'];

const dimensionLabel = (index: number): string => {
    if(index < DIMENSION_LABELS.length) return DIMENSION_LABELS[index];
    return `d${index}`;
};

const renderPrimitive = (value: unknown): ReactNode => {
    if(value === null || value === undefined){
        return <span className='plugin-detail-empty'>null</span>;
    }
    if(typeof value === 'boolean'){
        return (
            <span className={value ? 'plugin-detail-bool plugin-detail-bool--true' : 'plugin-detail-bool plugin-detail-bool--false'}>
                {value ? 'true' : 'false'}
            </span>
        );
    }
    if(typeof value === 'number'){
        if(!Number.isFinite(value)) return <span className='plugin-detail-empty'>{String(value)}</span>;
        const { short, long } = formatScientific(value, NUMERIC_PRECISION);
        return <span className='plugin-detail-number tabular-nums' title={short === long ? undefined : long}>{long}</span>;
    }
    if(typeof value === 'bigint'){
        return <span className='plugin-detail-number tabular-nums'>{value.toString()}</span>;
    }
    if(typeof value === 'string'){
        return <span className='plugin-detail-string'>{value.length === 0 ? '""' : value}</span>;
    }
    if(value instanceof Date){
        return <span className='plugin-detail-date tabular-nums'>{value.toISOString()}</span>;
    }
    return <span className='plugin-detail-fallback'>{JSON.stringify(value)}</span>;
};

const renderVector = (vector: number[]): ReactNode => {
    const magnitude = vectorMagnitude(vector);
    return (
        <div className='plugin-detail-vector'>
            <div className='plugin-detail-vector__row'>
                <span className='plugin-detail-vector__bracket'>⟨</span>
                {vector.map((component, index) => (
                    <Fragment key={index}>
                        {index > 0 && <span className='plugin-detail-vector__sep'>,</span>}
                        <span className='plugin-detail-vector__component tabular-nums'>{formatScientific(component, NUMERIC_PRECISION).long}</span>
                    </Fragment>
                ))}
                <span className='plugin-detail-vector__bracket'>⟩</span>
            </div>
            <div className='plugin-detail-vector__meta'>
                <span className='plugin-detail-vector__label'>‖v‖</span>
                <span className='tabular-nums'>{formatScientific(magnitude, NUMERIC_PRECISION).long}</span>
            </div>
        </div>
    );
};

const renderNumberArray = (values: number[]): ReactNode => {
    if(values.length === 0){
        return <span className='plugin-detail-empty'>[]</span>;
    }
    const capped = values.slice(0, MAX_ARRAY_ROWS);
    const overflow = values.length - capped.length;
    return (
        <div className='plugin-detail-array'>
            <div className='plugin-detail-array__meta'>
                <span>{values.length} values</span>
            </div>
            <div className='plugin-detail-array__list tabular-nums'>
                {capped.map((value, index) => (
                    <span key={index} className='plugin-detail-array__item'>
                        {formatScientific(value, NUMERIC_PRECISION).long}
                    </span>
                ))}
            </div>
            {overflow > 0 && (
                <div className='plugin-detail-array__overflow'>
                    +{overflow} more
                </div>
            )}
        </div>
    );
};

const renderPoints = (points: number[][]): ReactNode => {
    if(points.length === 0){
        return <span className='plugin-detail-empty'>[]</span>;
    }
    const dim = points[0].length;
    const capped = points.slice(0, MAX_ARRAY_ROWS);
    const overflow = points.length - capped.length;

    const gridStyle = { '--points-dim': dim } as React.CSSProperties;

    return (
        <div className='plugin-detail-points'>
            <div className='plugin-detail-points__meta'>
                <span>{points.length} points · dim {dim}</span>
            </div>
            <div className='plugin-detail-points__table'>
                <div className='plugin-detail-points__head' style={gridStyle}>
                    <span className='plugin-detail-points__index-cell'>#</span>
                    {Array.from({ length: dim }).map((_, index) => (
                        <span key={index} className='plugin-detail-points__cell-head'>{dimensionLabel(index)}</span>
                    ))}
                </div>
                <div className='plugin-detail-points__body'>
                    {capped.map((point, rowIndex) => (
                        <div key={rowIndex} className='plugin-detail-points__row' style={gridStyle}>
                            <span className='plugin-detail-points__index-cell tabular-nums'>{rowIndex}</span>
                            {point.map((component, colIndex) => (
                                <span key={colIndex} className='plugin-detail-points__cell tabular-nums'>
                                    {formatScientific(component, NUMERIC_PRECISION).long}
                                </span>
                            ))}
                        </div>
                    ))}
                </div>
            </div>
            {overflow > 0 && (
                <div className='plugin-detail-points__overflow'>
                    +{overflow} more rows
                </div>
            )}
        </div>
    );
};

const renderMatrix = (matrix: number[][]): ReactNode => {
    if(matrix.length === 0){
        return <span className='plugin-detail-empty'>[]</span>;
    }
    const cols = matrix.reduce((acc, row) => Math.max(acc, row.length), 0);
    return (
        <div className='plugin-detail-matrix'>
            <div className='plugin-detail-matrix__meta'>
                <span>{matrix.length}×{cols}</span>
            </div>
            <div className='plugin-detail-matrix__grid tabular-nums'>
                {matrix.map((row, rowIndex) => (
                    <div key={rowIndex} className='plugin-detail-matrix__row'>
                        {row.map((cell, colIndex) => (
                            <span key={colIndex} className='plugin-detail-matrix__cell'>
                                {formatScientific(cell, NUMERIC_PRECISION).long}
                            </span>
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
};

const renderObject = (value: Record<string, unknown>, depth = 0): ReactNode => {
    const entries = Object.entries(value);
    if(entries.length === 0){
        return <span className='plugin-detail-empty'>{'{}'}</span>;
    }

    return (
        <div className='plugin-detail-object' data-depth={depth}>
            {entries.map(([key, nested]) => (
                <div key={key} className='plugin-detail-object__row'>
                    <span className='plugin-detail-object__key'>{key}</span>
                    <div className='plugin-detail-object__value'>
                        {renderExpandedValue(nested, depth + 1)}
                    </div>
                </div>
            ))}
        </div>
    );
};

const renderHeterogeneousArray = (values: unknown[]): ReactNode => {
    if(values.length === 0){
        return <span className='plugin-detail-empty'>[]</span>;
    }
    return (
        <div className='plugin-detail-array'>
            <div className='plugin-detail-array__meta'>
                <span>{values.length} items</span>
            </div>
            <div className='plugin-detail-array__list'>
                {values.slice(0, MAX_ARRAY_ROWS).map((item, index) => (
                    <div key={index} className='plugin-detail-array__item plugin-detail-array__item--block'>
                        <span className='plugin-detail-array__item-index'>{index}</span>
                        <div className='plugin-detail-array__item-value'>
                            {renderExpandedValue(item, 1)}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export const renderExpandedValue = (value: unknown, depth = 0): ReactNode => {
    const kind = inferCellKind(value);

    switch(kind){
        case 'empty':
            return renderPrimitive(value);
        case 'boolean':
        case 'integer':
        case 'number':
        case 'string':
        case 'date':
            return renderPrimitive(value);
        case 'vector':
            return renderVector(value as number[]);
        case 'numberArray':
            return renderNumberArray(value as number[]);
        case 'points':
            return renderPoints(value as number[][]);
        case 'matrix':
            return renderMatrix(value as number[][]);
        case 'object':
            return renderObject(value as Record<string, unknown>, depth);
        case 'mixed':
        default:
            if(Array.isArray(value)){
                if(isNumberArray(value)){
                    return renderNumberArray(value);
                }
                if(isNumberMatrix(value)){
                    return renderMatrix(value);
                }
                return renderHeterogeneousArray(value);
            }
            return <span className='plugin-detail-fallback'>{JSON.stringify(value)}</span>;
    }
};
