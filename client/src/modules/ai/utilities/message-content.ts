import { Children, isValidElement } from 'react';
import type { ReactNode } from 'react';

interface ElementWithChildrenProps {
    children?: ReactNode;
};

export interface ParsedMarkdownTable {
    columns: string[];
    rows: Record<string, unknown>[];
};

export const isRecord = (value: unknown): value is Record<string, unknown> => {
    if (value === null || typeof value !== 'object') {
        return false;
    }

    return !Array.isArray(value);
};

export const stringifyArtifactValue = (value: unknown): string => {
    if (value == null) return '-';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);

    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
};

const getElementChildren = (node: ReactNode): ReactNode | undefined => {
    if (!isValidElement<ElementWithChildrenProps>(node)) {
        return undefined;
    }

    return node.props.children;
};

const extractTextFromChildren = (children: ReactNode): string => {
    const parts: string[] = [];

    Children.forEach(children, (child) => {
        if (typeof child === 'string' || typeof child === 'number') {
            parts.push(String(child));
        } else if (isValidElement<ElementWithChildrenProps>(child) && child.props.children) {
            parts.push(extractTextFromChildren(child.props.children));
        }
    });

    return parts.join('');
};

export const parseTableFromChildren = (children: ReactNode): ParsedMarkdownTable | null => {
    const columns: string[] = [];
    const rows: Record<string, unknown>[] = [];

    Children.forEach(children, (section) => {
        if (!isValidElement<ElementWithChildrenProps>(section)) return;

        const sectionType = section.type;
        const sectionChildren = getElementChildren(section);

        if (sectionType === 'thead') {
            Children.forEach(sectionChildren, (tr) => {
                if (!isValidElement<ElementWithChildrenProps>(tr)) return;

                Children.forEach(tr.props.children, (th) => {
                    if (!isValidElement<ElementWithChildrenProps>(th)) return;
                    columns.push(extractTextFromChildren(th.props.children));
                });
            });
        } else if (sectionType === 'tbody') {
            Children.forEach(sectionChildren, (tr) => {
                if (!isValidElement<ElementWithChildrenProps>(tr)) return;

                const row: Record<string, unknown> = {};
                let colIndex = 0;

                Children.forEach(tr.props.children, (td) => {
                    if (!isValidElement<ElementWithChildrenProps>(td)) return;

                    const colName = columns[colIndex] ?? `col_${colIndex}`;
                    row[colName] = extractTextFromChildren(td.props.children);
                    colIndex++;
                });

                rows.push(row);
            });
        }
    });

    if (columns.length === 0) return null;

    return { columns, rows };
};
