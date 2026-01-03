import { NodeType } from '@/types/models/plugin';
import logger from '@/logger';

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

    const match = path.match(/^\{\{\s*([^.}]+)\.([^}]+?)\s*\}\}$/);
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

const preview = (val: any): string => {
    if (val === null) return 'null';
    if (val === undefined) return 'undefined';
    if (Array.isArray(val)) return `array(len=${val.length})`;
    if (typeof val === 'object') return `object(keys=${Object.keys(val).slice(0, 30).join(',')})`;
    return `${typeof val}(${String(val).slice(0, 200)})`;
};

const schemaCandidatesForNode = (nodeId: string, ctx: ResolveContext): any[] => {
    const node = ctx.nodeMap.get(nodeId);
    if (!node) return [];

    const candidates: any[] = [];
    if (node?.data?.schema?.definition) candidates.push(node.data.schema.definition);
    if (node?.data?.schema) candidates.push(node.data.schema);
    if (node?.data?.definition) candidates.push(node.data.definition);
    if (node?.data?.schemaDefinition) candidates.push(node.data.schemaDefinition);
    if (node?.data) candidates.push(node.data);

    return candidates;
};

const getSchemaDescriptorForPath = (nodeId: string, propPath: string, ctx: ResolveContext): any | null => {
    const candidates = schemaCandidatesForNode(nodeId, ctx);
    const pathWith = propPath;
    const pathWithout = propPath.replace(/^definition\./, '');

    for (const root of candidates) {
        if (!root || typeof root !== 'object') continue;

        const a = pathWith ? getPath(root, pathWith) : root;
        if (a !== undefined) return a;

        const b = pathWithout ? getPath(root, pathWithout) : root;
        if (b !== undefined) return b;
    }

    return null;
};

const isNumericSchema = (schemaHint: any): boolean => {
    if (schemaHint === null || schemaHint === undefined) return false;

    if (typeof schemaHint === 'string') {
        const t = schemaHint.toLowerCase();
        return t === 'int' || t === 'float' || t === 'double' || t === 'number' || t === 'uint' || t === 'long' || t === 'short';
    }

    if (typeof schemaHint === 'object' && typeof schemaHint.type === 'string') {
        const t = schemaHint.type.toLowerCase();
        return t === 'number' || t === 'int' || t === 'float' || t === 'double';
    }

    return false;
};

const coerceNullish = (value: any, schemaHint: any): any => {
    if (value === null || value === undefined) {
        if (isNumericSchema(schemaHint)) return 0;
    }
    return value;
};

const getKeysFromDescriptor = (descriptor: any): string[] | null => {
    if (!descriptor || typeof descriptor !== 'object') return null;
    if (descriptor.keys && Array.isArray(descriptor.keys)) return descriptor.keys.map(String);
    return null;
};

const getItemSchemaFromDescriptor = (descriptor: any): any => {
    if (!descriptor || typeof descriptor !== 'object') return null;
    if (descriptor.schema && typeof descriptor.schema === 'object') return descriptor.schema;
    if (descriptor.items) return descriptor.items;
    if (descriptor.properties && typeof descriptor.properties === 'object') return descriptor.properties;
    return null;
};

const getChildSchema = (schemaHint: any, key: string): any => {
    if (!schemaHint || typeof schemaHint !== 'object') return null;

    if (schemaHint.schema && typeof schemaHint.schema === 'object') {
        return (schemaHint.schema as any)[key];
    }

    if (schemaHint.properties && typeof schemaHint.properties === 'object') {
        return (schemaHint.properties as any)[key];
    }

    return (schemaHint as any)[key];
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
    if (!ref) {
        logger.debug(`[ListingResolver::resolve] literal path="${path}"`);
        return path;
    }

    const node = ctx.nodeMap.get(ref.nodeId);
    if (!node) {
        logger.debug(`[ListingResolver::resolve] node missing nodeId=${ref.nodeId} path="${path}"`);
        return undefined;
    }

    const { propPath } = ref;

    logger.debug(`[ListingResolver::resolve] nodeId=${ref.nodeId} nodeType=${node.type} propPath="${propPath}"`);

    switch (node.type) {
        case NodeType.MODIFIER: {
            let out: any;
            if (propPath.startsWith('trajectory.')) out = getPath(ctx.trajectory, propPath.slice(11));
            else if (propPath.startsWith('analysis.')) out = getPath(ctx.analysis, propPath.slice(9));
            else out = getPath(node.data?.modifier, propPath);

            logger.debug(`[ListingResolver::resolve] MODIFIER resolved=${preview(out)}`);
            return out;
        }

        case NodeType.ARGUMENTS: {
            const out = getPath(ctx.analysis?.config, propPath);
            logger.debug(`[ListingResolver::resolve] ARGUMENTS resolved=${preview(out)}`);
            return out;
        }

        case NodeType.CONTEXT: {
            const out = propPath.startsWith('trajectory.')
                ? getPath(ctx.trajectory, propPath.slice(11))
                : getPath(ctx.trajectory, propPath);

            logger.debug(`[ListingResolver::resolve] CONTEXT resolved=${preview(out)}`);
            return out;
        }

        case NodeType.FOREACH: {
            const out = (propPath === 'currentValue.frame' || propPath === 'currentIndex') ? ctx.timestep : undefined;
            logger.debug(`[ListingResolver::resolve] FOREACH resolved=${preview(out)}`);
            return out;
        }

        case NodeType.SCHEMA: {
            const exposureId = findExposure(ref.nodeId, ctx.parentMap, ctx.nodeMap);
            if (!exposureId) {
                logger.debug(`[ListingResolver::resolve] SCHEMA exposureId not found for nodeId=${ref.nodeId}`);
                return undefined;
            }

            const data = ctx.exposureData.get(exposureId);
            const actualPath = propPath.replace(/^definition\./, '');
            const out = data ? getPath(data, actualPath) : undefined;

            logger.debug(`[ListingResolver::resolve] SCHEMA exposureId=${exposureId} data=${preview(data)} actualPath="${actualPath}" resolved=${preview(out)}`);
            return out;
        }

        case NodeType.EXPOSURE: {
            const base = ctx.exposureData.get(ref.nodeId);
            const out = getPath(base, propPath);
            logger.debug(`[ListingResolver::resolve] EXPOSURE base=${preview(base)} resolved=${preview(out)}`);
            return out;
        }

        default:
            logger.debug(`[ListingResolver::resolve] unsupported nodeType=${node.type} for nodeId=${ref.nodeId}`);
            return undefined;
    }
};

const getSchemaKeysForPath = (nodeId: string, propPath: string, ctx: ResolveContext): string[] | null => {
    const descriptor = getSchemaDescriptorForPath(nodeId, propPath, ctx);
    const keys = getKeysFromDescriptor(descriptor);
    return keys && keys.length ? keys : null;
};

const getOrderedKeys = (nodeId: string, propPath: string, val: any, ctx: ResolveContext, schemaHint: any): string[] => {
    if (Array.isArray(val)) {
        const out: string[] = [];
        for (let i = 0; i < val.length; i++) out.push(String(i));
        return out;
    }

    const hintKeys = getKeysFromDescriptor(schemaHint);
    if (hintKeys && hintKeys.length) return hintKeys;

    const schemaKeys = getSchemaKeysForPath(nodeId, propPath, ctx);
    if (schemaKeys && schemaKeys.length) return schemaKeys;

    if (val && typeof val === 'object') return Object.keys(val);

    return [];
};

const buildLabel = (baseLabel: string, parts: string[]): string => {
    if (baseLabel === 'auto') return parts.join(' ');
    if (!parts.length) return baseLabel;
    return `${baseLabel} ${parts.join(' ')}`;
};

const expandWildcard = (
    nodeId: string,
    baseValue: any,
    segments: string[],
    basePropPath: string,
    labelParts: string[],
    ctx: ResolveContext,
    out: Record<string, any>,
    ctxLabel: string,
    schemaHint: any
): void => {
    if (!segments.length) {
        const label = buildLabel(ctxLabel, labelParts);
        const v = coerceNullish(baseValue, schemaHint);
        out[label] = v;
        logger.debug(`[ListingResolver::expandWildcard] leaf label="${label}" value=${preview(v)} schema=${preview(schemaHint)}`);
        return;
    }

    const [seg, ...rest] = segments;

    if (seg === '*') {
        const descriptor = schemaHint ?? getSchemaDescriptorForPath(nodeId, basePropPath, ctx);
        const itemSchema = getItemSchemaFromDescriptor(descriptor);

        const keys = getOrderedKeys(nodeId, basePropPath, baseValue, ctx, descriptor);
        logger.debug(`[ListingResolver::expandWildcard] wildcard basePropPath="${basePropPath}" base=${preview(baseValue)} keys=${keys.join(',')} descriptor=${preview(descriptor)} itemSchema=${preview(itemSchema)}`);

        for (const key of keys) {
            let nextVal = baseValue != null ? baseValue[key] : undefined;

            if (nextVal === null || nextVal === undefined) {
                if (itemSchema && typeof itemSchema === 'object') nextVal = {};
            }

            expandWildcard(
                nodeId,
                nextVal,
                rest,
                basePropPath,
                labelParts.concat([String(key)]),
                ctx,
                out,
                ctxLabel,
                itemSchema
            );
        }
        return;
    }

    const next = baseValue != null ? baseValue[seg] : undefined;
    const nextPath = basePropPath ? `${basePropPath}.${seg}` : seg;
    const nextSchemaHint = schemaHint ? getChildSchema(schemaHint, seg) : null;

    logger.debug(`[ListingResolver::expandWildcard] step seg="${seg}" nextPath="${nextPath}" next=${preview(next)} nextSchema=${preview(nextSchemaHint)}`);

    expandWildcard(
        nodeId,
        next,
        rest,
        nextPath,
        labelParts,
        ctx,
        out,
        ctxLabel,
        nextSchemaHint
    );
};

export const resolveRow = (columns: Column[], ctx: ResolveContext): Record<string, any> => {
    const row: Record<string, any> = {};

    logger.debug(`[ListingResolver::resolveRow] timestep=${ctx.timestep} columns=${columns.length}`);

    for (const col of columns) {
        const ref = parseTemplate(col.path);

        if (ref && ref.propPath.includes('*')) {
            const segments = ref.propPath.split('.').filter(Boolean);
            const wildcardIndex = segments.indexOf('*');

            if (wildcardIndex === -1) {
                const v = resolve(col.path, ctx);
                const schemaHint = getSchemaDescriptorForPath(ref.nodeId, ref.propPath, ctx);
                const vv = coerceNullish(v, schemaHint);
                row[col.label] = vv;
                logger.debug(`[ListingResolver::resolveRow] col="${col.label}" path="${col.path}" noWildcard resolved=${preview(vv)} schema=${preview(schemaHint)}`);
                continue;
            }

            const baseSegments = segments.slice(0, wildcardIndex);
            const basePropPath = baseSegments.join('.');

            const baseValue = basePropPath
                ? resolve(`{{ ${ref.nodeId}.${basePropPath} }}`, ctx)
                : resolve(`{{ ${ref.nodeId} }}`, ctx);

            const descriptor = getSchemaDescriptorForPath(ref.nodeId, basePropPath, ctx);

            logger.debug(`[ListingResolver::resolveRow] wildcard col="${col.label}" path="${col.path}" nodeId=${ref.nodeId} basePropPath="${basePropPath}" base=${preview(baseValue)} descriptor=${preview(descriptor)}`);

            const out: Record<string, any> = {};

            expandWildcard(
                ref.nodeId,
                baseValue,
                segments.slice(wildcardIndex),
                basePropPath,
                [],
                ctx,
                out,
                col.label,
                descriptor
            );

            logger.debug(`[ListingResolver::resolveRow] wildcard expanded count=${Object.keys(out).length} keys=${Object.keys(out).slice(0, 80).join(',')}`);

            for (const [k, v] of Object.entries(out)) {
                row[k] = v;
            }
        } else if (ref) {
            const v = resolve(col.path, ctx);
            const schemaHint = getSchemaDescriptorForPath(ref.nodeId, ref.propPath, ctx);
            const vv = coerceNullish(v, schemaHint);
            row[col.label] = vv;
            logger.debug(`[ListingResolver::resolveRow] col="${col.label}" path="${col.path}" resolved=${preview(vv)} schema=${preview(schemaHint)}`);
        } else {
            const v = resolve(col.path, ctx);
            row[col.label] = v;
            logger.debug(`[ListingResolver::resolveRow] col="${col.label}" path="${col.path}" resolved=${preview(v)}`);
        }
    }

    logger.debug(`[ListingResolver::resolveRow] done rowKeys=${Object.keys(row).slice(0, 120).join(',')}`);
    return row;
};
