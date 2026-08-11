import { useCallback, useMemo } from 'react';
import { JsonView, darkStyles } from 'react-json-view-lite';
import 'react-json-view-lite/dist/index.css';
import { isRecord } from '@/shared/utils/type-guards';

type JsonTreeData = Record<string, unknown> | unknown[];

interface TruncatedArray {
    _truncated: boolean;
    totalLength: number;
    preview: unknown[];
}

interface JsonTreeProps {
    data: JsonTreeData;
    defaultExpanded?: boolean;
}

const isTruncatedArray = (value: unknown): value is TruncatedArray =>
    isRecord(value) && value._truncated === true;

const normalizeValue = (value: unknown): unknown => {
    if (value === null || value === undefined) {
        return value;
    }

    if (isTruncatedArray(value)) {
        const items = value.preview.map(normalizeValue);
        return { [`Array(${value.totalLength}) [truncated]`]: items };
    }

    if (Array.isArray(value)) {
        return value.map(normalizeValue);
    }

    if (isRecord(value)) {
        const result: Record<string, unknown> = {};
        for (const [key, val] of Object.entries(value)) {
            result[key] = normalizeValue(val);
        }
        return result;
    }

    return value;
};

const JSON_TREE_STYLES = {
    ...darkStyles,
    container: 'font-[inherit] text-xs leading-normal',
    basicChildStyle: 'pl-0',
    label: 'inline-flex items-center gap-[2px] select-none text-[var(--syntax-key)]',
    clickableLabel: 'inline-flex items-center gap-[2px] select-none text-[var(--syntax-key)] cursor-pointer',
    nullValue: 'italic text-[var(--syntax-null)]',
    undefinedValue: 'italic text-[var(--syntax-null)]',
    numberValue: 'text-[var(--syntax-primitive)]',
    stringValue: 'break-all text-[var(--syntax-string)]',
    booleanValue: 'text-[var(--syntax-primitive)]',
    otherValue: 'text-[var(--syntax-primitive)]',
    punctuation: 'text-[0.7rem] text-[var(--syntax-meta)]',
    collapsedContent: 'text-[0.7rem] text-[var(--syntax-meta)]',
    expandIcon: 'inline-flex cursor-pointer select-none items-center',
    collapseIcon: 'inline-flex cursor-pointer select-none items-center',
    childFieldsContainer: 'ml-[0.4rem] border-l border-border pl-4'
};

const JsonTree = ({ data, defaultExpanded = true }: JsonTreeProps) => {
    const normalized = useMemo(() => normalizeValue(data) as JsonTreeData, [data]);
    const shouldExpandNode = useCallback((level: number) => defaultExpanded && level < 2, [defaultExpanded]);

    return (
        <JsonView
            data={normalized}
            shouldExpandNode={shouldExpandNode}
            style={JSON_TREE_STYLES}
        />
    );
};

export default JsonTree;
