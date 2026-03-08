import { useMemo } from 'react';
import { JsonView, darkStyles } from 'react-json-view-lite';
import 'react-json-view-lite/dist/index.css';
import './JsonTree.css';

interface TruncatedArray {
    _truncated: boolean;
    totalLength: number;
    preview: unknown[];
}

const isTruncatedArray = (value: unknown): value is TruncatedArray => {
    if (typeof value !== 'object' || value === null) {
        return false;
    }
    return '_truncated' in value && (value as Record<string, unknown>)._truncated === true;
};

const normalizeTruncated = (value: unknown): unknown => {
    if (value === null || value === undefined) {
        return value;
    }

    if (isTruncatedArray(value)) {
        const items = (value.preview ?? []).map(normalizeTruncated);
        return { [`Array(${value.totalLength}) [truncated]`]: items };
    }

    if (Array.isArray(value)) {
        return value.map(normalizeTruncated);
    }

    if (typeof value === 'object') {
        const result: Record<string, unknown> = {};
        for (const [key, val] of Object.entries(value)) {
            result[key] = normalizeTruncated(val);
        }
        return result;
    }

    return value;
};

interface JsonTreeProps {
    data: Record<string, unknown> | unknown[];
    defaultExpanded?: boolean;
}

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
    const normalized = useMemo(() => normalizeTruncated(data), [data]);

    const shouldExpandNode = useMemo(() => {
        if (!defaultExpanded) {
            return () => false;
        }
        return (level: number) => level < 2;
    }, [defaultExpanded]);

    return (
        <JsonView
            data={normalized as Record<string, unknown> | unknown[]}
            shouldExpandNode={shouldExpandNode}
            style={JSON_TREE_STYLES}
        />
    );
};

export default JsonTree;
