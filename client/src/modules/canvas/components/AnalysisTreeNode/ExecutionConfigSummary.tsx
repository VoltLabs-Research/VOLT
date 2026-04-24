import Box from '@/shared/presentation/primitives/Box';
import Row from '@/shared/presentation/primitives/Row';
import Stack from '@/shared/presentation/primitives/Stack';
import Text from '@/shared/presentation/primitives/Text';
import { ANALYSIS_EXECUTION_METADATA_KEY } from '@/modules/canvas/utilities/selected-timestep-analysis';
import { useMemo } from 'react';
import type { ReactNode } from 'react';

const ACRONYMS = new Set(['id', 'url', 'api', 'ui', 'sdk', 'rdf', 'rms', 'pbc', 'xyz']);

const MAX_INLINE_STRING = 40;
const MAX_INLINE_NUMBER_ARRAY = 4;
const MAX_INLINE_STRING_ARRAY = 6;

const humanizeKey = (key: string): string => {
    const words = key
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/[_\-\s]+/g, ' ')
        .trim()
        .split(' ')
        .filter(Boolean);

    if (words.length === 0) return key;

    return words
        .map((word, index) => {
            const lower = word.toLowerCase();
            if (ACRONYMS.has(lower)) return lower.toUpperCase();
            if (index === 0) return lower.charAt(0).toUpperCase() + lower.slice(1);
            return lower;
        })
        .join(' ');
};

const formatNumber = (value: number): string => {
    if (!Number.isFinite(value)) return String(value);
    if (Number.isInteger(value)) return value.toString();
    return value.toFixed(3);
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

interface RenderedValue {
    node: ReactNode;
    mono: boolean;
};

const MutedPlaceholder = () => <Text tone='muted'>—</Text>;

const renderValue = (value: unknown): RenderedValue => {
    if (value === null || value === undefined || value === '') {
        return { node: <MutedPlaceholder />, mono: false };
    }

    if (typeof value === 'boolean') {
        return { node: value ? 'Yes' : 'No', mono: false };
    }

    if (typeof value === 'number') {
        return { node: formatNumber(value), mono: true };
    }

    if (typeof value === 'string') {
        if (value.length <= MAX_INLINE_STRING) {
            return { node: value, mono: false };
        }
        return {
            node: <Text truncate title={value}>{value}</Text>,
            mono: false
        };
    }

    if (Array.isArray(value)) {
        if (value.length === 0) return { node: <MutedPlaceholder />, mono: false };

        if (value.every((item) => typeof item === 'number')) {
            const numbers = value as number[];
            const full = `[${numbers.map(formatNumber).join(', ')}]`;
            if (numbers.length <= MAX_INLINE_NUMBER_ARRAY) {
                return { node: full, mono: true };
            }
            const preview = numbers.slice(0, MAX_INLINE_NUMBER_ARRAY).map(formatNumber).join(', ');
            return {
                node: <span title={full}>{`[${preview}, … ${numbers.length} values]`}</span>,
                mono: true
            };
        }

        if (value.every((item) => typeof item === 'string')) {
            const strings = value as string[];
            const joined = strings.join(', ');
            if (strings.length <= MAX_INLINE_STRING_ARRAY && joined.length <= MAX_INLINE_STRING) {
                return { node: joined, mono: false };
            }
            return { node: `${strings.length} items`, mono: false };
        }

        return { node: `${value.length} items`, mono: false };
    }

    if (isPlainObject(value)) {
        const count = Object.keys(value).length;
        return { node: count === 0 ? <MutedPlaceholder /> : `${count} fields`, mono: false };
    }

    return { node: String(value), mono: false };
};

interface ConfigRow {
    label: string;
    value: ReactNode;
    mono: boolean;
};

interface ConfigColumn {
    title: string;
    rows: ConfigRow[];
};

const buildColumn = (title: string, source: Record<string, unknown>): ConfigColumn => {
    const rows = Object.entries(source).map(([key, value]) => {
        const rendered = renderValue(value);
        return { label: humanizeKey(key), value: rendered.node, mono: rendered.mono };
    });
    return { title, rows };
};

const buildScopeColumn = (metadata: unknown): ConfigColumn | undefined => {
    if (!isPlainObject(metadata)) return undefined;

    const selected = metadata.selectedTimesteps;
    if (!Array.isArray(selected) || selected.length === 0) return undefined;

    const numbers = selected.filter((item): item is number => typeof item === 'number');
    if (numbers.length === 0) return undefined;

    const sorted = [...numbers].sort((left, right) => left - right);

    return {
        title: 'Scope',
        rows: [
            { label: 'Timesteps', value: String(sorted.length), mono: true },
            { label: 'Range', value: `${sorted[0]} – ${sorted[sorted.length - 1]}`, mono: true }
        ]
    };
};

interface ExecutionConfigSummaryProps {
    config: Record<string, unknown>;
};

const ExecutionConfigSummary = ({ config }: ExecutionConfigSummaryProps) => {
    const columns = useMemo<ConfigColumn[]>(() => {
        const parameters: Record<string, unknown> = {};
        const nestedObjectEntries: [string, Record<string, unknown>][] = [];
        let metadata: unknown;

        for (const [key, value] of Object.entries(config)) {
            if (key === ANALYSIS_EXECUTION_METADATA_KEY) {
                metadata = value;
                continue;
            }
            if (isPlainObject(value) && Object.keys(value).length > 0) {
                nestedObjectEntries.push([key, value]);
                continue;
            }
            parameters[key] = value;
        }

        const result: ConfigColumn[] = [];

        if (Object.keys(parameters).length > 0) {
            result.push(buildColumn('Parameters', parameters));
        }

        for (const [key, value] of nestedObjectEntries) {
            result.push(buildColumn(humanizeKey(key), value));
        }

        const scopeColumn = buildScopeColumn(metadata);
        if (scopeColumn) result.push(scopeColumn);

        return result;
    }, [config]);

    if (columns.length === 0) {
        return (
            <Box p='1'>
                <Text size='sm' tone='muted'>No parameters configured.</Text>
            </Box>
        );
    }

    return (
        <Box p='1'>
            <Row align='start' gap='1-5' wrap>
                {columns.map((column) => (
                    <Stack key={column.title} gap='05' style={{ minWidth: 140 }}>
                        <Text size='xs' tone='muted'>{column.title}</Text>
                        {column.rows.map((row) => (
                            <Row key={row.label} justify='between' gap='1' className='font-size-1 color-secondary'>
                                <Text tone='muted'>{row.label}</Text>
                                <span className={row.mono ? 'font-mono tabular-nums' : undefined}>
                                    {row.value}
                                </span>
                            </Row>
                        ))}
                    </Stack>
                ))}
            </Row>
        </Box>
    );
};

export default ExecutionConfigSummary;
