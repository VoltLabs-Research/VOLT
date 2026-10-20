import { Fragment, type ReactNode } from 'react';
import { cn } from '@heroui/react';
import { inferCellKind } from '@/modules/plugin/components/listing/PluginCompactTable/typeInference';
import { formatScientific, vectorMagnitude } from '@/modules/plugin/components/listing/PluginCompactTable/formatters';
import Scrollable from '@/shared/ui/components/Scrollable';

const NUMERIC_PRECISION = 8;
const MAX_ARRAY_ROWS = 500;

const DIMENSION_LABELS = ['x', 'y', 'z', 'w'];

const renderPrimitive = (value: unknown): ReactNode => {
    if(value === null || value === undefined){
        return <span className='text-muted'>null</span>;
    }
    if(typeof value === 'boolean'){
        return (
            <span className={cn('text-sm font-medium tabular-nums', value ? 'text-foreground' : 'text-muted')}>
                {value ? 'true' : 'false'}
            </span>
        );
    }
    if(typeof value === 'number'){
        if(!Number.isFinite(value)) return <span className='text-muted'>{String(value)}</span>;
        const { short, long } = formatScientific(value, NUMERIC_PRECISION);
        return <span className='break-words tabular-nums lining-nums' title={short === long ? undefined : long}>{long}</span>;
    }
    if(typeof value === 'bigint'){
        return <span className='break-words tabular-nums lining-nums'>{value.toString()}</span>;
    }
    if(typeof value === 'string'){
        return <span className='break-words tabular-nums lining-nums'>{value.length === 0 ? '""' : value}</span>;
    }
    if(value instanceof Date){
        return <span className='break-words tabular-nums lining-nums'>{value.toISOString()}</span>;
    }
    return <span className='break-all font-mono text-sm text-muted'>{JSON.stringify(value)}</span>;
};

const renderVector = (vector: number[]): ReactNode => {
    const magnitude = vectorMagnitude(vector);
    return (
        <div className='flex flex-row flex-wrap items-baseline gap-2.5'>
            <div className='inline-flex flex-row flex-wrap items-baseline gap-1 tabular-nums lining-nums'>
                <span className='text-muted'>⟨</span>
                {vector.map((component, index) => (
                    <Fragment key={index}>
                        {index > 0 && <span className='text-muted'>,</span>}
                        <span className='break-all text-foreground tabular-nums'>{formatScientific(component, NUMERIC_PRECISION).long}</span>
                    </Fragment>
                ))}
                <span className='text-muted'>⟩</span>
            </div>
            <div className='inline-flex flex-row items-baseline gap-1 text-xs text-muted'>
                <span className='font-mono'>‖v‖</span>
                <span className='tabular-nums'>{formatScientific(magnitude, NUMERIC_PRECISION).long}</span>
            </div>
        </div>
    );
};

const renderNumberArray = (values: number[]): ReactNode => {
    if(values.length === 0){
        return <span className='text-muted'>[]</span>;
    }
    const capped = values.slice(0, MAX_ARRAY_ROWS);
    const overflow = values.length - capped.length;
    return (
        <div className='flex flex-col gap-1.5'>
            <div className='text-2xs text-muted'>
                <span>{values.length} values</span>
            </div>
            <Scrollable className='flex max-h-[180px] flex-row flex-wrap gap-x-3 gap-y-1 tabular-nums'>
                {capped.map((value, index) => (
                    <span key={index} className='text-sm text-foreground tabular-nums lining-nums'>
                        {formatScientific(value, NUMERIC_PRECISION).long}
                    </span>
                ))}
            </Scrollable>
            {overflow > 0 && (
                <div className='text-2xs text-muted'>
                    +{overflow} more
                </div>
            )}
        </div>
    );
};

const renderPoints = (points: number[][]): ReactNode => {
    if(points.length === 0){
        return <span className='text-muted'>[]</span>;
    }
    const dim = points[0].length;
    const capped = points.slice(0, MAX_ARRAY_ROWS);
    const overflow = points.length - capped.length;

    const gridStyle = { '--points-dim': dim } as React.CSSProperties;

    return (
        <div className='flex flex-col gap-1.5'>
            <div className='text-2xs text-muted'>
                <span>{points.length} points · dim {dim}</span>
            </div>
            <div className='flex flex-col'>
                <div
                    className={cn(
                        'grid grid-cols-[32px_repeat(var(--points-dim,3),minmax(80px,1fr))] gap-1 py-1 text-sm tabular-nums lining-nums',
                        'border-b border-border bg-surface text-2xs font-medium text-muted'
                    )}
                    style={gridStyle}
                >
                    <span className='text-inherit'>#</span>
                    {Array.from({ length: dim }).map((_, index) => (
                        <span key={index} className='overflow-hidden whitespace-nowrap text-ellipsis text-inherit'>
                            {DIMENSION_LABELS[index] ?? `d${index}`}
                        </span>
                    ))}
                </div>
                <Scrollable className='flex max-h-[240px] flex-col'>
                    {capped.map((point, rowIndex) => (
                        <div
                            key={rowIndex}
                            className={cn('grid grid-cols-[32px_repeat(var(--points-dim,3),minmax(80px,1fr))] gap-1 py-1 text-sm tabular-nums lining-nums', rowIndex > 0 ? 'border-t border-border' : null)}
                            style={gridStyle}
                        >
                            <span className='text-muted tabular-nums'>{rowIndex}</span>
                            {point.map((component, colIndex) => (
                                <span key={colIndex} className='overflow-hidden whitespace-nowrap text-ellipsis text-foreground tabular-nums'>
                                    {formatScientific(component, NUMERIC_PRECISION).long}
                                </span>
                            ))}
                        </div>
                    ))}
                </Scrollable>
            </div>
            {overflow > 0 && (
                <div className='text-2xs text-muted'>
                    +{overflow} more rows
                </div>
            )}
        </div>
    );
};

const renderMatrix = (matrix: number[][]): ReactNode => {
    if(matrix.length === 0){
        return <span className='text-muted'>[]</span>;
    }
    const cols = matrix.reduce((acc, row) => Math.max(acc, row.length), 0);
    return (
        <div className='flex flex-col gap-1.5'>
            <div className='text-2xs text-muted'>
                <span>{matrix.length}×{cols}</span>
            </div>
            <Scrollable className='flex max-h-[220px] flex-col tabular-nums'>
                {matrix.map((row, rowIndex) => (
                    <div
                        key={rowIndex}
                        className={cn('flex flex-row gap-4 py-1', rowIndex > 0 ? 'border-t border-border' : null)}
                    >
                        {row.map((cell, colIndex) => (
                            <span key={colIndex} className='min-w-[60px] text-foreground tabular-nums lining-nums'>
                                {formatScientific(cell, NUMERIC_PRECISION).long}
                            </span>
                        ))}
                    </div>
                ))}
            </Scrollable>
        </div>
    );
};

const renderObject = (value: Record<string, unknown>, depth = 0): ReactNode => {
    const entries = Object.entries(value);
    if(entries.length === 0){
        return <span className='text-muted'>{'{}'}</span>;
    }

    return (
        <div
            className={cn('flex flex-col gap-2', depth === 0 ? 'pl-0' : 'border-l border-border pl-3')}
            data-depth={depth}
        >
            {entries.map(([key, nested]) => (
                <div key={key} className='flex flex-col gap-1'>
                    <span className='font-mono text-2xs font-medium text-muted'>{key}</span>
                    <div className='min-w-0 [overflow-wrap:anywhere]'>
                        {renderExpandedValue(nested, depth + 1)}
                    </div>
                </div>
            ))}
        </div>
    );
};

const renderHeterogeneousArray = (values: unknown[]): ReactNode => {
    if(values.length === 0){
        return <span className='text-muted'>[]</span>;
    }
    const capped = values.slice(0, MAX_ARRAY_ROWS);
    return (
        <div className='flex flex-col gap-1.5'>
            <div className='text-2xs text-muted'>
                <span>{values.length} items</span>
            </div>
            <Scrollable className='flex max-h-[180px] flex-row flex-wrap gap-x-3 gap-y-1'>
                {capped.map((item, index) => (
                    <div
                        key={index}
                        className={cn(
                            'flex w-full flex-col gap-1 border-b border-border pb-2 text-sm text-foreground tabular-nums lining-nums',
                            index === capped.length - 1 ? 'border-b-0 pb-0' : null
                        )}
                    >
                        <span className='text-2xs text-muted'>{index}</span>
                        <div className='min-w-0'>
                            {renderExpandedValue(item, 1)}
                        </div>
                    </div>
                ))}
            </Scrollable>
        </div>
    );
};

export const renderExpandedValue = (value: unknown, depth = 0): ReactNode => {
    const kind = inferCellKind(value);

    switch(kind){
        case 'empty':
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
                return renderHeterogeneousArray(value);
            }
            return <span className='break-all font-mono text-sm text-muted'>{JSON.stringify(value)}</span>;
    }
};
