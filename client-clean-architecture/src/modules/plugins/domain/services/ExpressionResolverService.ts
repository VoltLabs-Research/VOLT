/**
 * Node reference for expression resolution.
 */
export interface ExpressionNode {
    id: string;
    type: string;
    data?: Record<string, any>;
}

/**
 * Edge reference for expression resolution.
 */
export interface ExpressionEdge {
    source: string;
    target: string;
}

/**
 * Available expression that can be used in node configurations.
 */
export interface AvailableExpression {
    nodeId: string;
    nodeName: string;
    nodeType: string;
    path: string;
    fullExpression: string;
    type: string;
    description?: string;
}

/**
 * Output schema definition.
 */
export interface OutputSchemaEntry {
    type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'any';
    description?: string;
    children?: Record<string, OutputSchemaEntry>;
}

/**
 * Service for resolving expressions in plugin workflows.
 * Pure domain logic - no external dependencies.
 */
export class ExpressionResolverService {
    /**
     * Gets all ancestor nodes (nodes connected upstream).
     * Pure BFS traversal.
     *
     * @param nodeId - Starting node ID
     * @param nodes - All nodes in the workflow
     * @param edges - All edges in the workflow
     * @returns Array of ancestor nodes
     */
    getAncestorNodes(
        nodeId: string,
        nodes: ExpressionNode[],
        edges: ExpressionEdge[]
    ): ExpressionNode[] {
        const ancestors: ExpressionNode[] = [];
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

    /**
     * Gets available expressions from ancestor nodes.
     *
     * @param nodeId - Target node ID
     * @param nodes - All nodes in the workflow
     * @param edges - All edges in the workflow
     * @param outputSchemas - Output schemas per node type
     * @returns Array of available expressions
     */
    getAvailableExpressions(
        nodeId: string,
        nodes: ExpressionNode[],
        edges: ExpressionEdge[],
        outputSchemas: Record<string, Record<string, OutputSchemaEntry>>
    ): AvailableExpression[] {
        const ancestors = this.getAncestorNodes(nodeId, nodes, edges);
        const expressions: AvailableExpression[] = [];

        for (const ancestor of ancestors) {
            const nodeType = ancestor.type;
            const nodeName = ancestor.id;
            const schema = outputSchemas[nodeType];

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

                // Expand children if defined
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
        }

        return expressions;
    }

    /**
     * Checks if a string contains expression syntax ({{ ... }}).
     * Pure regex check.
     */
    containsExpression(value: string): boolean {
        return /\{\{[^}]+\}\}/.test(value);
    }

    /**
     * Extracts all expressions from a string.
     */
    extractExpressions(value: string): string[] {
        const matches = value.match(/\{\{([^}]+)\}\}/g);
        return matches || [];
    }

    /**
     * Parses an expression to get node and path.
     */
    parseExpression(expression: string): { nodeId: string; path: string } | null {
        const match = expression.match(/\{\{\s*([^.]+)\.(.+)\s*\}\}/);
        if (!match) return null;

        return {
            nodeId: match[1].trim(),
            path: match[2].trim()
        };
    }
}
