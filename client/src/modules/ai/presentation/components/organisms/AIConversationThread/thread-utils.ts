import { Children, isValidElement } from 'react';
import type { ReactNode } from 'react';

export const isRecord = (value: unknown): value is Record<string, unknown> => {
    if (value === null || typeof value !== 'object') {
        return false;
    }

    return !Array.isArray(value);
};

export const stringifyArtifactValue = (value: unknown): string => {
    if (value == null) return '\u2014';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);

    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
};

const getElementProps = (el: unknown): Record<string, unknown> => {
    return ((el as { props?: Record<string, unknown> })?.props) ?? {};
};

const extractTextFromChildren = (children: ReactNode): string => {
    const parts: string[] = [];
    Children.forEach(children, (child) => {
        if (typeof child === 'string' || typeof child === 'number') {
            parts.push(String(child));
        } else if (isValidElement(child)) {
            const props = getElementProps(child);
            if (props.children) {
                parts.push(extractTextFromChildren(props.children as ReactNode));
            }
        }
    });
    return parts.join('');
};

export const parseTableFromChildren = (
    children: ReactNode
): { columns: string[]; rows: Record<string, unknown>[] } | null => {
    const columns: string[] = [];
    const rows: Record<string, unknown>[] = [];

    Children.forEach(children, (section) => {
        if (!isValidElement(section)) return;

        const sectionProps = getElementProps(section);
        const sectionType = section.type;
        const sectionChildren = sectionProps.children as ReactNode;

        if (sectionType === 'thead') {
            Children.forEach(sectionChildren, (tr) => {
                if (!isValidElement(tr)) return;
                const trProps = getElementProps(tr);
                Children.forEach(trProps.children as ReactNode, (th) => {
                    if (!isValidElement(th)) return;
                    const thProps = getElementProps(th);
                    columns.push(extractTextFromChildren(thProps.children as ReactNode));
                });
            });
        } else if (sectionType === 'tbody') {
            Children.forEach(sectionChildren, (tr) => {
                if (!isValidElement(tr)) return;
                const trProps = getElementProps(tr);
                const row: Record<string, unknown> = {};
                let colIndex = 0;
                Children.forEach(trProps.children as ReactNode, (td) => {
                    if (!isValidElement(td)) return;
                    const tdProps = getElementProps(td);
                    const colName = columns[colIndex] ?? `col_${colIndex}`;
                    row[colName] = extractTextFromChildren(tdProps.children as ReactNode);
                    colIndex++;
                });
                rows.push(row);
            });
        }
    });

    if (columns.length === 0) return null;
    return { columns, rows };
};
