import logger from '@shared/infrastructure/logger';

export interface Column {
    path: string;
    label: string;
}

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

    // Match node type by prefix
    if (ref.nodeId.startsWith('arguments-')) {
        return getPath(context.arguments, propPath);
    }
    
    if (ref.nodeId.startsWith('forEach-')) {
        // ForEach nodes resolve to timestep for currentValue.frame
        if (propPath === 'currentValue.frame' || propPath === 'currentIndex') {
            return context.timestep;
        }
        return undefined;
    }
    
    if (ref.nodeId.startsWith('modifier-')) {
        // Modifier with analysis.*
        if (propPath.startsWith('analysis.')) {
            return getPath(context.analysis, propPath.slice(9));
        }
        return undefined;
    }
    
    if (ref.nodeId.startsWith('schema-')) {
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
        const value = resolve(col.path, metadata);
        row[col.label] = value ?? null; 
    }

    return row;
};
