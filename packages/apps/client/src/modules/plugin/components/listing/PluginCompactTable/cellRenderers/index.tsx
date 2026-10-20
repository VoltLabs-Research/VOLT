import { Fragment } from 'react';
import { formatUnknownValue } from '@/shared/utils/format';
import {
    formatScientific,
    isNumberArray,
    summarizeScalar,
    vectorMagnitude
} from '@/modules/plugin/components/listing/PluginCompactTable/formatters';
import type { InferredColumnType, InferredCellKind } from '@/modules/plugin/components/listing/PluginCompactTable/typeInference';
import { inferCellKind } from '@/modules/plugin/components/listing/PluginCompactTable/typeInference';
import type { ReactNode } from 'react';

interface CellProps {
    value: unknown;
}

type ResolvedNumberArrayValue =
    | { numbers: number[]; fallback?: never }
    | { numbers?: never; fallback: ReactNode };

const MAX_SUMMARY_KEYS = 2;
const EMPTY_CELL = <span className='italic'>-</span>;
const EMPTY_ARRAY_CELL = <span className='italic'>[]</span>;

const resolveNumberArrayCellValue = (value: unknown): ResolvedNumberArrayValue => {
    if (!isNumberArray(value)) return { fallback: EMPTY_CELL };
    if (value.length === 0) return { fallback: EMPTY_ARRAY_CELL };
    return { numbers: value };
};

const isNumberMatrix = (input: unknown, requireNonEmptyRows = false): input is number[][] => (
    Array.isArray(input)
    && input.every((row) => (
        Array.isArray(row)
        && (!requireNonEmptyRows || row.length > 0)
        && row.every((cell) => typeof cell === 'number')
    ))
);

const BooleanCell = ({ value }: CellProps) => {
    if (value === true) {
        return <span className='inline-flex size-4 flex-row items-center justify-center rounded-sm bg-success/14 text-xs font-semibold leading-none' title='true' aria-label='true'>✓</span>;
    }
    if (value === false) {
        return <span className='inline-flex size-4 flex-row items-center justify-center rounded-sm bg-danger/12 text-xs font-semibold leading-none' title='false' aria-label='false'>✕</span>;
    }
    return EMPTY_CELL;
};

const DateCell = ({ value }: CellProps) => {
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) return EMPTY_CELL;

    const iso = value.toISOString();
    const display = iso.replace('T', ' ').replace(/\.\d+Z$/, 'Z');
    return <span className='overflow-hidden text-ellipsis tabular-nums' title={iso}>{display}</span>;
};

const FallbackCell = ({ value }: CellProps) => {
    if (value === null || value === undefined) return EMPTY_CELL;

    const text = formatUnknownValue(value);
    return <span className='overflow-hidden text-ellipsis' title={text}>{text}</span>;
};

const IntegerCell = ({ value }: CellProps) => {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return <span className='overflow-hidden text-ellipsis tabular-nums'>{String(value)}</span>;
    }
    if (typeof value === 'bigint') {
        return <span className='overflow-hidden text-ellipsis tabular-nums'>{value.toString()}</span>;
    }
    return EMPTY_CELL;
};

const MatrixCell = ({ value }: CellProps) => {
    if (!isNumberMatrix(value)) return EMPTY_CELL;
    if (value.length === 0) return EMPTY_ARRAY_CELL;

    const rows = value.length;
    const cols = value.reduce((acc, row) => Math.max(acc, row.length), 0);

    return (
        <span className='inline-flex flex-row items-baseline gap-1 tabular-nums' title={JSON.stringify(value)}>
            <span className='font-medium'>{rows}×{cols}</span>
            <span className='text-2xs'>matrix</span>
        </span>
    );
};

const NumberArrayCell = ({ value }: CellProps) => {
    const resolved = resolveNumberArrayCellValue(value);
    if ('fallback' in resolved) return resolved.fallback;

    const { numbers } = resolved;
    let min = numbers[0];
    let max = numbers[0];
    for (const entry of numbers) {
        if (entry < min) min = entry;
        if (entry > max) max = entry;
    }

    return (
        <span className='inline-flex flex-row items-center gap-1.5 overflow-hidden whitespace-nowrap text-ellipsis tabular-nums' title={JSON.stringify(numbers)}>
            <span className='text-2xs'>[{numbers.length}]</span>
            <span>
                {formatScientific(min, 3).short} … {formatScientific(max, 3).short}
            </span>
        </span>
    );
};

const NumberCell = ({ value }: CellProps) => {
    if (typeof value !== 'number') {
        if (typeof value === 'bigint') {
            const text = value.toString();
            return <span className='overflow-hidden text-ellipsis tabular-nums lining-nums' title={text}>{text}</span>;
        }
        return EMPTY_CELL;
    }

    if (!Number.isFinite(value)) {
        return <span className='italic tabular-nums'>{String(value)}</span>;
    }

    const { short, long } = formatScientific(value, 4);
    return <span className='overflow-hidden text-ellipsis tabular-nums lining-nums' title={short === long ? undefined : long}>{short}</span>;
};

const ObjectCell = ({ value }: CellProps) => {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return EMPTY_CELL;

    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return <span className='italic'>{'{}'}</span>;

    const visible = entries.slice(0, MAX_SUMMARY_KEYS);
    const overflow = entries.length - visible.length;

    return (
        <span className='inline-flex flex-row items-baseline gap-0.5 overflow-hidden whitespace-nowrap text-ellipsis tabular-nums lining-nums' title={JSON.stringify(value)}>
            <span>{'{'}</span>
            {visible.map(([key, raw], index) => (
                <Fragment key={key}>
                    {index > 0 && <span className='mr-1'>,</span>}
                    <span>{key}</span>
                    <span className='mr-1'>:</span>
                    <span className='tabular-nums'>{summarizeScalar(raw)}</span>
                </Fragment>
            ))}
            {overflow > 0 && <span className='ml-0.5 text-2xs'>, +{overflow}</span>}
            <span>{'}'}</span>
        </span>
    );
};

const PointsCell = ({ value }: CellProps) => {
    if (!isNumberMatrix(value, true)) return EMPTY_CELL;
    if (value.length === 0) return EMPTY_ARRAY_CELL;

    const title = `${value.length} point${value.length === 1 ? '' : 's'}`;
    return <span className='overflow-hidden whitespace-nowrap text-ellipsis tabular-nums' title={title}>{value.length}</span>;
};

const StringCell = ({ value }: CellProps) => {
    if (typeof value !== 'string' || value.length === 0) return EMPTY_CELL;
    return <span className='overflow-hidden text-ellipsis tabular-nums' title={value}>{value}</span>;
};

const VectorCell = ({ value }: CellProps) => {
    const resolved = resolveNumberArrayCellValue(value);
    if ('fallback' in resolved) return resolved.fallback;

    const { numbers } = resolved;
    const magnitude = vectorMagnitude(numbers);
    const title = `${JSON.stringify(numbers)}  |v|=${magnitude.toPrecision(6)}`;

    return (
        <span className='inline-flex flex-row items-baseline gap-0.5 overflow-hidden whitespace-nowrap text-ellipsis tabular-nums lining-nums' title={title}>
            <span className='font-medium'>⟨</span>
            {numbers.map((component, index) => (
                <Fragment key={index}>
                    {index > 0 && <span className='mr-0.5'>,</span>}
                    <span>{formatScientific(component, 3).short}</span>
                </Fragment>
            ))}
            <span className='font-medium'>⟩</span>
        </span>
    );
};

const CELL_RENDERERS: Partial<Record<InferredCellKind, (props: CellProps) => ReactNode>> = {
    boolean: BooleanCell,
    integer: IntegerCell,
    number: NumberCell,
    string: StringCell,
    date: DateCell,
    vector: VectorCell,
    numberArray: NumberArrayCell,
    points: PointsCell,
    matrix: MatrixCell,
    object: ObjectCell,
    mixed: FallbackCell
};

export const renderInferredCell = (value: unknown, inferred?: InferredColumnType): ReactNode => {
    const columnKind = inferred?.kind;
    const shouldInferFromValue = !columnKind || columnKind === 'mixed' || columnKind === 'empty';
    const kind: InferredCellKind = shouldInferFromValue ? inferCellKind(value) : columnKind;
    const Cell = CELL_RENDERERS[kind] ?? FallbackCell;

    return kind === 'empty' ? EMPTY_CELL : <Cell value={value} />;
};
