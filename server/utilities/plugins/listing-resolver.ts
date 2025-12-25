import { NodeType } from '@/types/models/plugin';

export interface ResolveContext {
    nodeMap: Map<string, any>;
    parentMap: Map<string, string[]>;
    exposureData: Map<string, any>;
    trajectory: any;
    analysis: any;
    timestep: number;
};

export interface Column {
    path: string;
    label: string;
};

const templateCache = new Map<string, { nodeId: string, propPath: string } | null>();

const parseTemplate = (path: string): { nodeId: string, propPath: string } | null => {
    let cached = templateCache.get(path);
    if (cached !== undefined) return cached;

    const match = path.match(/^\{{\s*([^.}]+)\.([^}]+)\s*\}\}$/);
    cached = match ? { nodeId: match[1], propPath: match[2].trim() } : null;
    templateCache.set(path, cached);
    return cached;
};

const getPath = (obj: any, path: string): any => {
    if (!obj) return undefined;
    const keys = path.split('.');
    let result = obj;
    for (let i = 0; i < keys.length && result != null; i++) {
        result = result[keys[i]];
    }

    return result;
};

// node lookup map once per plugin
export const buildNodeMap = (nodes: any): Map<string, any> => {
    const map = new Map();
    for (const node of nodes) map.set(node.id, node);
    return map;
};

// edge lookup for finding connected exposures
export const buildParentMap = (edges: any[]): Map<string, string[]> => {
    const map = new Map<string, string[]>();
    for (const edge of edges) {
        const parents = map.get(edge.target) || [];
        parents.push(edge.source);
        map.set(edge.target, parents);
    }
    return map;
};

// find exposure connected to a node(bfs with early exit)
const findExposure = (nodeId: string, parentMap: Map<string, string[]>, nodeMap: Map<string, any>): string | null => {
    const queue = [nodeId];
    const visited = new Set<string>();

    while (queue.length) {
        const id = queue.shift()!;
        if (visited.has(id)) continue;
        visited.add(id);

        const node = nodeMap.get(id);
        if (node?.type === NodeType.EXPOSURE) return id;

        const parents = parentMap.get(id);
        if (parents) queue.push(...parents);
    }
    return null;
};

export const resolve = (path: string, ctx: ResolveContext): any => {
    const ref = parseTemplate(path);
    if (!ref) return path;

    const node = ctx.nodeMap.get(ref.nodeId);
    if (!node) return undefined;

    const { propPath } = ref;

    switch (node.type) {
        case NodeType.MODIFIER:
            if (propPath.startsWith('trajectory.')) return getPath(ctx.trajectory, propPath.slice(11));
            if (propPath.startsWith('analysis.')) return getPath(ctx.analysis, propPath.slice(9));
            return getPath(node.data?.modifier, propPath);

        case NodeType.ARGUMENTS:
            return getPath(ctx.analysis?.config, propPath);

        case NodeType.CONTEXT:
            return propPath.startsWith('trajectory.')
                ? getPath(ctx.trajectory, propPath.slice(11))
                : getPath(ctx.trajectory, propPath);

        case NodeType.FOREACH:
            return (propPath === 'currentValue.frame' || propPath === 'currentIndex') ? ctx.timestep : undefined;

        case NodeType.SCHEMA:
            const exposureId = findExposure(ref.nodeId, ctx.parentMap, ctx.nodeMap);
            if (!exposureId) return undefined;
            const data = ctx.exposureData.get(exposureId);
            return data ? getPath(data, propPath.replace(/^definition\./, '')) : undefined;

        case NodeType.EXPOSURE:
            return getPath(ctx.exposureData.get(ref.nodeId), propPath);

        default:
            return undefined;
    }
};

export const resolveRow = (columns: Column[], ctx: ResolveContext): Record<string, any> => {
    const row: Record<string, any> = {};
    for (const col of columns) {
        row[col.label] = resolve(col.path, ctx);
    }
    return row;
};
