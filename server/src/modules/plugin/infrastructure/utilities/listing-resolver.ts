import logger from '@shared/infrastructure/logger';

export interface Column {
    path: string;
    label: string;
}

const AUTO_LABEL = 'auto';

// Parse template like "{{ nodeId.path }}"
const parseTemplate = (path: string): { nodeId: string, propPath: string } | null => {
    const match = path.match(/^\{\{\s*([^.}]+)\.([^}]+?)\s*\}\}$/);
    return match ? { nodeId: match[1], propPath: match[2].trim() } : null;
};

// Get nested value using dot notation
const getPath = (obj: any, path: string): any => {
    if (!obj) return undefined;
    const keys = path.split('.');
    let result = obj;
    for (const key of keys) {
        if (result == null) return undefined;
        result = result[key];
    }
    return result;
};

const resolveWildcardPath = (obj: any, path: string): Record<string, any> => {
    const keys = path.split('.');
    const wildcardIndex = keys.indexOf('*');
    if (wildcardIndex === -1) return {};

    const parentPath = keys.slice(0, wildcardIndex).join('.');
    const childPath = keys.slice(wildcardIndex + 1).join('.');
    const source = parentPath ? getPath(obj, parentPath) : obj;

    if (!source || typeof source !== 'object') return {};

    const expanded: Record<string, any> = {};
    for (const [key, value] of Object.entries(source as Record<string, any>)) {
        const resolved = childPath ? getPath(value, childPath) : value;
        if (resolved !== undefined) {
            expanded[key] = resolved;
        }
    }

    return expanded;
};

const resolveAutoColumns = (path: string, metadata: any): Record<string, any> | null => {
    const ref = parseTemplate(path);
    if (!ref || !ref.propPath.includes('*')) return null;

    const context = metadata._resolvedContext;
    if (!context) return null;
    const { propPath } = ref;

    if (propPath.startsWith('analysis.')) {
        return resolveWildcardPath(context.analysis, propPath.slice(9));
    }

    const argumentExpanded = resolveWildcardPath(context.arguments, propPath);
    if (Object.keys(argumentExpanded).length > 0) {
        return argumentExpanded;
    }

    if (ref.nodeId.startsWith('arguments-') || ref.nodeId === 'arguments') {
        return resolveWildcardPath(context.arguments, propPath);
    }

    if (ref.nodeId.startsWith('modifier-') || ref.nodeId === 'modifier') {
        if (!propPath.startsWith('analysis.')) {
            return {};
        }
        return resolveWildcardPath(context.analysis, propPath.slice(9));
    }

    if (
        ref.nodeId.startsWith('schema-') ||
        ref.nodeId === 'schema' ||
        propPath.startsWith('definition.')
    ) {
        const actualPath = propPath.replace(/^definition\./, '');
        return resolveWildcardPath(metadata, actualPath);
    }

    return null;
};

// Resolve a single template path
export const resolve = (path: string, metadata: any): any => {
    const ref = parseTemplate(path);
    if (!ref) return path; // Literal value

    const context = metadata._resolvedContext;
    if (!context) {
        logger.warn(`[SimpleResolver] No _resolvedContext in metadata for path: ${path}`);
        return undefined;
    }

    const { propPath } = ref;

    if (propPath === 'currentValue.frame' || propPath === 'currentIndex') {
        return context.timestep;
    }

    if (propPath.startsWith('analysis.')) {
        return getPath(context.analysis, propPath.slice(9));
    }

    const argumentValue = getPath(context.arguments, propPath);
    if (argumentValue !== undefined) {
        return argumentValue;
    }

    // Match node type by prefix
    if (ref.nodeId.startsWith('arguments-') || ref.nodeId === 'arguments') {
        return getPath(context.arguments, propPath);
    }
    
    if (ref.nodeId.startsWith('forEach-') || ref.nodeId === 'forEach') {
        // ForEach nodes resolve to timestep for currentValue.frame
        if (propPath === 'currentValue.frame' || propPath === 'currentIndex') {
            return context.timestep;
        }
        return undefined;
    }
    
    if (ref.nodeId.startsWith('modifier-') || ref.nodeId === 'modifier') {
        // Modifier with analysis.*
        if (propPath.startsWith('analysis.')) {
            return getPath(context.analysis, propPath.slice(9));
        }
        return undefined;
    }
    
    if (
        ref.nodeId.startsWith('schema-') ||
        ref.nodeId === 'schema' ||
        propPath.startsWith('definition.')
    ) {
        // Schema nodes resolve from the exposure metadata itself
        const actualPath = propPath.replace(/^definition\./, '');
        return getPath(metadata, actualPath);
    }

    logger.warn(`[SimpleResolver] Unsupported node type for: ${ref.nodeId}`);
    return undefined;
};

// Resolve all columns to create a row
export const resolveRow = (columns: Column[], metadata: any, analysisCreatedAt: Date): Record<string, any> => {
    const row: Record<string, any> = {};

    // Override analysis.createdAt with actual value
    if (metadata._resolvedContext?.analysis) {
        metadata._resolvedContext.analysis.createdAt = analysisCreatedAt;
    }

    for (const col of columns) {
        if (col.label.trim().toLowerCase() === AUTO_LABEL) {
            const expandedColumns = resolveAutoColumns(col.path, metadata);
            if (expandedColumns) {
                for (const [label, value] of Object.entries(expandedColumns)) {
                    row[label] = value ?? null;
                }
                continue;
            }
        }

        const value = resolve(col.path, metadata);
        row[col.label] = value ?? null; 
    }

    return row;
};
