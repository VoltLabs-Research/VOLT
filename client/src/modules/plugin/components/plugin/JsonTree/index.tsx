import { useMemo } from 'react';
import { JsonView, darkStyles } from 'react-json-view-lite';
import 'react-json-view-lite/dist/index.css';
import { isRecord } from '@/shared/utils/type-guards';
import './JsonTree.css';

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

const isTruncatedArray = (value: unknown): value is TruncatedArray => {
    if (!isRecord(value)) {
        return false;
    }
    return '_truncated' in value && value._truncated === true;
};

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

const normalizeData = (data: JsonTreeData): JsonTreeData => {
    if (Array.isArray(data)) {
        return data.map(normalizeValue);
    }

    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
        result[key] = normalizeValue(value);
    }

    return result;
};

const JSON_TREE_STYLES = {
    ...darkStyles,
    container: 'json-tree-container',
    basicChildStyle: 'json-tree-child',
    label: 'json-tree-key',
    clickableLabel: 'json-tree-key cursor-pointer',
    nullValue: 'json-tree-null',
    undefinedValue: 'json-tree-null',
    numberValue: 'json-tree-primitive',
    stringValue: 'json-tree-string',
    booleanValue: 'json-tree-primitive',
    otherValue: 'json-tree-primitive',
    punctuation: 'json-tree-meta',
    collapsedContent: 'json-tree-meta',
    expandIcon: 'json-tree-toggle',
    collapseIcon: 'json-tree-toggle',
    childFieldsContainer: 'json-tree-children'
};

const JsonTree = ({ data, defaultExpanded = true }: JsonTreeProps) => {
    const normalized = useMemo(() => normalizeData(data), [data]);

    const shouldExpandNode = useMemo(() => {
        if (!defaultExpanded) {
            return () => false;
        }
        return (level: number) => level < 2;
    }, [defaultExpanded]);

    return (
        <JsonView
            data={normalized}
            shouldExpandNode={shouldExpandNode}
            style={JSON_TREE_STYLES}
        />
    );
};

export default JsonTree;
