import { Fragment, type ReactNode } from 'react';
import { cn } from '@heroui/react';
import { inferCellKind } from '@/modules/plugin/components/listing/PluginCompactTable/typeInference';
import { formatScientific, vectorMagnitude } from '@/modules/plugin/components/listing/PluginCompactTable/formatters';

const NUMERIC_PRECISION = 8;
const MAX_ARRAY_ROWS = 500;

const DIMENSION_LABELS = ['x', 'y', 'z', 'w'];

/**
 * `SubListingDetailPanel.css`'s renderer half, as utilities.
 *
 * Four of its rules were sibling/positional selectors, and each becomes a ternary
 * over an index the renderer already has — `.plugin-detail-points__row + …__row`
 * and `.plugin-detail-matrix__row + …__row` become `index > 0`,
 * `.plugin-detail-array__item--block:last-child` becomes the last capped index, and
 * `.plugin-detail-object:not([data-depth="0"])` becomes `depth > 0`. `data-depth` is
 * kept on the element regardless: it is the only thing that makes the recursion
 * legible in the inspector.
 *
 * The one rule that stays a runtime custom property is the points grid. Its column
 * count is the data's dimensionality, set inline as `--points-dim`, and Tailwind can
 * name a `var()` inside an arbitrary value — so
 * `grid-cols-[32px_repeat(var(--points-dim,3),minmax(80px,1fr))]` is a complete
 * static literal that still reads a value only JavaScript knows.
 */
const META_CLASS = 'text-[0.6875rem] text-muted';
const STACK_CLASS = 'flex flex-col gap-[0.4rem]';
const NUMERIC_CLASS = 'break-words tabular-nums lining-nums';

const POINTS_GRID_CLASS = 'grid grid-cols-[32px_repeat(var(--points-dim,3),minmax(80px,1fr))] gap-1 py-[0.3rem] text-[0.8125rem] tabular-nums lining-nums';
const POINTS_CELL_CLASS = 'overflow-hidden whitespace-nowrap text-ellipsis text-foreground';

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
        return <span className={NUMERIC_CLASS} title={short === long ? undefined : long}>{long}</span>;
    }
    if(typeof value === 'bigint'){
        return <span className={NUMERIC_CLASS}>{value.toString()}</span>;
    }
    if(typeof value === 'string'){
        return <span className={NUMERIC_CLASS}>{value.length === 0 ? '""' : value}</span>;
    }
    if(value instanceof Date){
        return <span className={NUMERIC_CLASS}>{value.toISOString()}</span>;
    }
    return <span className='break-all font-mono text-[0.8125rem] text-muted'>{JSON.stringify(value)}</span>;
};

const renderVector = (vector: number[]): ReactNode => {
    const magnitude = vectorMagnitude(vector);
    return (
        <div className='flex flex-row flex-wrap items-baseline gap-[0.6rem]'>
            <div className='inline-flex flex-row flex-wrap items-baseline gap-[0.2rem] tabular-nums lining-nums'>
                <span className='text-muted'>⟨</span>
                {vector.map((component, index) => (
                    <Fragment key={index}>
                        {index > 0 && <span className='text-muted'>,</span>}
                        <span className='break-all text-foreground tabular-nums'>{formatScientific(component, NUMERIC_PRECISION).long}</span>
                    </Fragment>
                ))}
                <span className='text-muted'>⟩</span>
            </div>
            <div className='inline-flex flex-row items-baseline gap-[0.3rem] text-xs text-muted'>
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
        <div className={STACK_CLASS}>
            <div className={META_CLASS}>
                <span>{values.length} values</span>
            </div>
            <div className='flex max-h-[180px] flex-row flex-wrap gap-x-3 gap-y-1 overflow-y-auto tabular-nums'>
                {capped.map((value, index) => (
                    <span key={index} className='text-[0.8125rem] text-foreground tabular-nums lining-nums'>
                        {formatScientific(value, NUMERIC_PRECISION).long}
                    </span>
                ))}
            </div>
            {overflow > 0 && (
                <div className={META_CLASS}>
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
        <div className={STACK_CLASS}>
            <div className={META_CLASS}>
                <span>{points.length} points · dim {dim}</span>
            </div>
            <div className='flex max-h-[240px] flex-col overflow-auto'>
                <div
                    className={cn(
                        POINTS_GRID_CLASS,
                        'sticky top-0 z-[1] border-b border-border bg-surface backdrop-blur-md text-[0.6875rem] font-medium text-muted'
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
                <div className='flex flex-col'>
                    {capped.map((point, rowIndex) => (
                        <div
                            key={rowIndex}
                            className={cn(POINTS_GRID_CLASS, rowIndex > 0 ? 'border-t border-border' : null)}
                            style={gridStyle}
                        >
                            <span className='text-muted tabular-nums'>{rowIndex}</span>
                            {point.map((component, colIndex) => (
                                <span key={colIndex} className={cn(POINTS_CELL_CLASS, 'tabular-nums')}>
                                    {formatScientific(component, NUMERIC_PRECISION).long}
                                </span>
                            ))}
                        </div>
                    ))}
                </div>
            </div>
            {overflow > 0 && (
                <div className={META_CLASS}>
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
        <div className={STACK_CLASS}>
            <div className={META_CLASS}>
                <span>{matrix.length}×{cols}</span>
            </div>
            <div className='flex max-h-[220px] flex-col overflow-auto tabular-nums'>
                {matrix.map((row, rowIndex) => (
                    <div
                        key={rowIndex}
                        className={cn('flex flex-row gap-4 py-[0.2rem]', rowIndex > 0 ? 'border-t border-border' : null)}
                    >
                        {row.map((cell, colIndex) => (
                            <span key={colIndex} className='min-w-[60px] text-foreground tabular-nums lining-nums'>
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
        return <span className='text-muted'>{'{}'}</span>;
    }

    return (
        <div
            className={cn('flex flex-col gap-[0.55rem]', depth === 0 ? 'pl-0' : 'border-l border-border pl-3')}
            data-depth={depth}
        >
            {entries.map(([key, nested]) => (
                <div key={key} className='flex flex-col gap-[0.2rem]'>
                    <span className='font-mono text-[0.6875rem] font-medium text-muted'>{key}</span>
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
        <div className={STACK_CLASS}>
            <div className={META_CLASS}>
                <span>{values.length} items</span>
            </div>
            <div className='flex max-h-[180px] flex-row flex-wrap gap-x-3 gap-y-1 overflow-y-auto'>
                {capped.map((item, index) => (
                    <div
                        key={index}
                        className={cn(
                            'flex w-full flex-col gap-[0.2rem] border-b border-border pb-2 text-[0.8125rem] text-foreground tabular-nums lining-nums',
                            index === capped.length - 1 ? 'border-b-0 pb-0' : null
                        )}
                    >
                        <span className={META_CLASS}>{index}</span>
                        <div className='min-w-0'>
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
            // `mixed` is only produced for arrays that are neither all-numbers
            // nor all-number-rows, and for values that are not objects at all.
            if(Array.isArray(value)){
                return renderHeterogeneousArray(value);
            }
            return <span className='break-all font-mono text-[0.8125rem] text-muted'>{JSON.stringify(value)}</span>;
    }
};
