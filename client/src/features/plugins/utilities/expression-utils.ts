import { type Node, type Edge } from '@xyflow/react';
import { NodeType } from '@/types/plugin';
import { formatDistanceToNow } from 'date-fns';
import { getValueByPath } from '@/utilities/common/getValueByPath';

export type ColumnDef = {
    path: string;
    label: string;
};

export interface NodeOutputSchema {
    [key: string]: {
        type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'any';
        description?: string;
        children?: NodeOutputSchema;
    };
};

export interface AvailableExpression {
    nodeId: string;
    nodeName: string;
    nodeType: NodeType;
    path: string;
    fullExpression: string;
    type: string;
    description?: string;
};

const NODE_OUTPUT_SCHEMAS = {
    [NodeType.MODIFIER]: {
        name: { type: 'string', description: 'Plugin name' },
        version: { type: 'string', description: 'Plugin version' },
        description: { type: 'string', description: 'Plugin description' },
        author: { type: 'string', description: 'Plugin author' },
        license: { type: 'string', description: 'License type' },
        homepage: { type: 'string', description: 'Homepage URL' },
        icon: { type: 'string', description: 'Icon name' }
    },
    [NodeType.ARGUMENTS]: {
        as_str: { type: 'string', description: 'Arguments as string' },
        as_array: { type: 'array', description: 'Arguments as array' },
    },
    [NodeType.CONTEXT]: {
        trajectory_dumps: { type: 'array', description: 'List of dump file paths' },
        count: { type: 'number', description: 'Number of dumps' }
    },
    [NodeType.FOREACH]: {
        items: { type: 'array', description: 'Items being iterated' },
        count: { type: 'number', description: 'Total item count' },
        currentValue: { type: 'string', description: 'Current iteration value' },
        currentIndex: { type: 'number', description: 'Current iteration index' },
        outputPath: { type: 'string', description: 'Output path for current iteration' }
    },
    [NodeType.ENTRYPOINT]: {
        results: { type: 'array', description: 'Execution results' },
        successCount: { type: 'number', description: 'Successful executions' },
        failCount: { type: 'number', description: 'Failed executions' }
    },
    [NodeType.EXPOSURE]: {
        name: { type: 'string', description: 'Exposure name' },
        data: { type: 'any', description: 'Exposed data' },
        count: { type: 'number', description: 'Data item count' },
        storageKey: { type: 'string', description: 'Storage path' }
    },
    [NodeType.SCHEMA]: {
        definition: { type: 'object', description: 'Schema definition object' }
    },
    [NodeType.VISUALIZERS]: {
        canvas: { type: 'boolean', description: 'Canvas enabled' },
        raster: { type: 'boolean', description: 'Raster enabled' },
        listing: { type: 'object', description: 'Listing columns' }
    },
    [NodeType.EXPORT]: {
        success: { type: 'boolean', description: 'Export success status' },
        objectPath: { type: 'string', description: 'Exported file path' },
        exporter: { type: 'string', description: 'Exporter used' },
        type: { type: 'string', description: 'Export format' }
    }
};

export function getAncestorNodes(nodeId: string, nodes: Node[], edges: Edge[]): Node[] {
    const ancestors: Node[] = [];
    const visited = new Set<string>();
    const queue: string[] = [nodeId];

    while (queue.length > 0) {
        const currentId = queue.shift()!;
        if (visited.has(currentId)) continue;
        visited.add(currentId);

        // Find edges where this node is the target
        const incomingEdges = edges.filter(e => e.target === currentId);
        for (const edge of incomingEdges) {
            const sourceNode = nodes.find(n => n.id === edge.source);
            if (sourceNode && !visited.has(sourceNode.id)) {
                ancestors.push(sourceNode);
                queue.push(sourceNode.id);
            }
        }
    }

    return ancestors;
}

export function getAvailableExpressions(
    nodeId: string,
    nodes: Node[],
    edges: Edge[]
): AvailableExpression[] {
    const ancestors = getAncestorNodes(nodeId, nodes, edges);
    const expressions: AvailableExpression[] = [];

    for (const ancestor of ancestors) {
        const nodeType = ancestor.type as NodeType;
        const nodeName = ancestor.id;
        const schema = NODE_OUTPUT_SCHEMAS[nodeType];

        if (!schema) continue;

        // Add static schema properties
        for (const [key, info] of Object.entries(schema)) {
            expressions.push({
                nodeId: ancestor.id,
                nodeName,
                nodeType,
                path: key,
                fullExpression: `{{ ${nodeName}.${key} }}`,
                type: info.type,
                description: info.description
            });

            // For objects, we could expand children if defined
            if (info.children) {
                for (const [childKey, childInfo] of Object.entries(info.children)) {
                    expressions.push({
                        nodeId: ancestor.id,
                        nodeName,
                        nodeType,
                        path: `${key}.${childKey}`,
                        fullExpression: `{{ ${nodeName}.${key}.${childKey} }}`,
                        type: childInfo.type,
                        description: childInfo.description
                    });
                }
            }
        }

        // Special handling for Arguments node - add dynamic argument keys
        if (nodeType === NodeType.ARGUMENTS) {
            const nodeData = ancestor.data as Record<string, any>;
            const argDefs = nodeData.arguments?.arguments || [];
            for (const arg of argDefs) {
                if (arg.argument) {
                    expressions.push({
                        nodeId: ancestor.id,
                        nodeName,
                        nodeType,
                        path: arg.argument,
                        fullExpression: `{{ ${nodeName}.${arg.argument} }}`,
                        type: arg.type || 'any',
                        description: arg.label || `Argument: ${arg.argument}`
                    });
                }
            }
        }

        // Special handling for Schema node - add definition keys
        if (nodeType === NodeType.SCHEMA) {
            const nodeData = ancestor.data as Record<string, any>;
            const definition = nodeData.schema?.definition || {};
            for (const key of Object.keys(definition)) {
                expressions.push({
                    nodeId: ancestor.id,
                    nodeName,
                    nodeType,
                    path: `definition.${key}`,
                    fullExpression: `{{ ${nodeName}.definition.${key} }}`,
                    type: 'any',
                    description: `Schema field: ${key}`
                });
            }
        }
    }

    return expressions;
}

export const formatCellValue = (value: any, path: string): string => {
    if (value === null || value === undefined) {
        return '-';
    }

    if (typeof value === 'number') {
        return Number.isInteger(value)
            ? value.toLocaleString()
            : Number(value).toFixed(4).replace(/\.?0+$/, '');
    }

    if (typeof value === 'string') {
        if (path.toLowerCase().includes('createdat') || path.toLowerCase().endsWith('date')) {
            try {
                return formatDistanceToNow(new Date(value), { addSuffix: true });
            } catch (e) {
                return value;
            }
        }
        return value;
    }

    if (Array.isArray(value)) {
        return value.map((v) => formatCellValue(v, path)).join(', ');
    }

    if (typeof value === 'object') {
        if ('name' in value && typeof value.name === 'string') {
            return String(value.name);
        }
        return JSON.stringify(value);
    }
    return String(value);
};

export const resolveDynamicColumns = (rows: any[], columns: ColumnDef[]): { columns: ColumnDef[], rows: any[] } => {
    // First, determine all available columns by scanning rows for wildcard expansions
    const expandedColumns: ColumnDef[] = [];
    const expandedKeys = new Set<string>();

    // Pass 1: Expand columns
    columns.forEach(col => {
        if (col.path.includes('*')) {
            const match = col.path.match(/^\{\{\s*([^\.]+)\.(.+)\s*\}\}$/);
            if (match) {
                const [_, nodeId, propPath] = match;
                const parts = propPath.split('*');
                const basePath = parts[0].replace(/\.$/, '');
                const remainingPath = parts[1] ? parts[1].replace(/^\./, '') : '';

                rows.forEach(row => {
                    const baseValue = getValueByPath(row, basePath) || getValueByPath(row, basePath.split('.').pop()!);

                    if (baseValue && typeof baseValue === 'object') {
                        Object.keys(baseValue).forEach(key => {
                            const label = col.label === 'auto' ? key : `${col.label} ${key}`;
                            const fullPath = `${col.path}::${key}`; // internal unique path
                            if (!expandedKeys.has(fullPath)) {
                                expandedKeys.add(fullPath);
                                expandedColumns.push({
                                    label: label,
                                    path: fullPath,
                                    // Store meta to resolve later
                                    _meta: { basePath, key, remainingPath }
                                } as any);
                            }
                        });
                    }
                });
            }
        } else {
            expandedColumns.push(col);
        }
    });

    // Pass 2: Resolve values
    const normalizedRows = rows.map(row => {
        const enriched = { ...row };
        expandedColumns.forEach(col => {
            let val;
            if ((col as any)._meta) {
                const { basePath, key, remainingPath } = (col as any)._meta;
                const baseValue = getValueByPath(row, basePath) || getValueByPath(row, basePath.split('.').pop()!);
                if (baseValue && baseValue[key]) {
                    val = remainingPath ? getValueByPath(baseValue[key], remainingPath) : baseValue[key];
                }
            } else {
                val = getValueByPath(row, col.path);
            }
            enriched[col.label] = formatCellValue(val, col.path);
        });

        if (!enriched._id) {
            enriched._id = row.timestep ?? row._objectKey ?? `row-${Math.random().toString(36).slice(2)}`;
        }
        return enriched;
    });

    return { columns: expandedColumns, rows: normalizedRows };
};

export const normalizeRows = (rows: any[], columns: ColumnDef[]) => {
    return rows.map((row) => {
        const enriched = { ...row };
        columns.forEach((col) => {
            const { path, label } = col;
            let resolved = getValueByPath(row, path);

            if (resolved === undefined && label) {
                resolved = getValueByPath(row, label);
            }

            enriched[path] = formatCellValue(resolved, path);
        });

        if (!enriched._id) {
            enriched._id = row.timestep ?? row._objectKey ?? `row-${Math.random().toString(36).slice(2)}`;
        }
        return enriched;
    });
};

export function containsExpression(value: string): boolean {
    return /\{\{[^}]+\}\}/.test(value);
}
