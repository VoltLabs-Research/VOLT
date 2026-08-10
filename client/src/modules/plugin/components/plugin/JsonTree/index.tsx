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

/*
 * `react-json-view-lite` takes a class name per slot, so `JsonTree.css` was only ever
 * a lookup from slot to declarations — which makes it the one sheet in this module
 * that converts by pasting utilities into the object it already had. The library's
 * own `dist/index.css` still supplies the tree's layout and stays imported; it is a
 * package stylesheet, not an app one.
 *
 * `--syntax-key` / `-string` / `-primitive` / `-null` / `-meta` came from bravais and
 * are now declared per-theme in the global sheet, so naming them in an arbitrary
 * value is safe. They are the only five colours here that are NOT HeroUI tokens: a
 * JSON viewer's key/string/number hues are a syntax palette, not part of the UI's
 * surface ladder, so they were never candidates for the §3a collapse.
 */
const JSON_TREE_KEY_CLASS = 'inline-flex items-center gap-[2px] select-none text-[var(--syntax-key)]';
const JSON_TREE_CLICKABLE_KEY_CLASS = 'inline-flex items-center gap-[2px] select-none text-[var(--syntax-key)] cursor-pointer';
const JSON_TREE_META_CLASS = 'text-[0.7rem] text-[var(--syntax-meta)]';
const JSON_TREE_PRIMITIVE_CLASS = 'text-[var(--syntax-primitive)]';
const JSON_TREE_NULL_CLASS = 'italic text-[var(--syntax-null)]';
const JSON_TREE_TOGGLE_CLASS = 'inline-flex cursor-pointer select-none items-center';

const JSON_TREE_STYLES = {
    ...darkStyles,
    container: 'font-[inherit] text-xs leading-normal',
    basicChildStyle: 'pl-0',
    label: JSON_TREE_KEY_CLASS,
    clickableLabel: JSON_TREE_CLICKABLE_KEY_CLASS,
    nullValue: JSON_TREE_NULL_CLASS,
    undefinedValue: JSON_TREE_NULL_CLASS,
    numberValue: JSON_TREE_PRIMITIVE_CLASS,
    stringValue: 'break-all text-[var(--syntax-string)]',
    booleanValue: JSON_TREE_PRIMITIVE_CLASS,
    otherValue: JSON_TREE_PRIMITIVE_CLASS,
    punctuation: JSON_TREE_META_CLASS,
    collapsedContent: JSON_TREE_META_CLASS,
    expandIcon: JSON_TREE_TOGGLE_CLASS,
    collapseIcon: JSON_TREE_TOGGLE_CLASS,
    childFieldsContainer: 'ml-[0.4rem] border-l border-border pl-4'
};

const JsonTree = ({ data, defaultExpanded = true }: JsonTreeProps) => {
    // Memoised: normalising walks the whole payload, which can be large.
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
