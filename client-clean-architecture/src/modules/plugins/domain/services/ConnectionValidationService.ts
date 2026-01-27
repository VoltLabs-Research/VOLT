/**
 * Node configuration for connection validation.
 */
export interface NodeConnectionConfig {
    type: string;
    inputs: number;
    outputs: number;
    allowedConnections: {
        from: string[];
        to: string[];
    };
}

/**
 * Node reference for validation.
 */
export interface NodeRef {
    id: string;
    type: string;
}

/**
 * Edge reference for validation.
 */
export interface EdgeRef {
    id: string;
    source: string;
    target: string;
}

/**
 * Connection to validate.
 */
export interface ConnectionToValidate {
    source: string | null;
    target: string | null;
}

/**
 * Validation result.
 */
export interface ConnectionValidationResult {
    valid: boolean;
    reason?: string;
}

/**
 * Service for validating node connections in the plugin builder.
 * Pure domain logic - no external dependencies.
 */
export class ConnectionValidationService {
    /**
     * Validates a connection between two nodes.
     *
     * @param connection - The connection to validate
     * @param nodes - All nodes in the workflow
     * @param edges - Existing edges in the workflow
     * @param nodeConfigs - Configuration for each node type
     * @returns Validation result with reason if invalid
     */
    validateConnection(
        connection: ConnectionToValidate,
        nodes: NodeRef[],
        edges: EdgeRef[],
        nodeConfigs: Record<string, NodeConnectionConfig>
    ): ConnectionValidationResult {
        const { source, target } = connection;

        // Basic validation
        if (!source || !target) {
            return { valid: false, reason: 'Missing source or target' };
        }

        if (source === target) {
            return { valid: false, reason: 'Cannot connect node to itself' };
        }

        // Find nodes
        const srcNode = nodes.find(n => n.id === source);
        const tgtNode = nodes.find(n => n.id === target);

        if (!srcNode?.type || !tgtNode?.type) {
            return { valid: false, reason: 'Source or target node not found' };
        }

        // Get configs
        const srcConfig = nodeConfigs[srcNode.type];
        const tgtConfig = nodeConfigs[tgtNode.type];

        if (!srcConfig || !tgtConfig) {
            return { valid: false, reason: 'Node type configuration not found' };
        }

        // Check allowed connections
        if (!srcConfig.allowedConnections.to.includes(tgtNode.type)) {
            return {
                valid: false,
                reason: `${srcNode.type} cannot connect to ${tgtNode.type}`
            };
        }

        // Check for duplicate edge
        if (edges.some(e => e.source === source && e.target === target)) {
            return { valid: false, reason: 'Connection already exists' };
        }

        // Check target input limit
        const tgtLimit = typeof tgtConfig.inputs === 'number' ? tgtConfig.inputs : 1;
        if (tgtLimit !== -1) {
            const existingInputs = edges.filter(e => e.target === target).length;
            if (existingInputs >= tgtLimit) {
                return {
                    valid: false,
                    reason: `Target node has reached maximum inputs (${tgtLimit})`
                };
            }
        }

        // Check source output limit
        const srcLimit = srcConfig.outputs;
        if (srcLimit !== -1) {
            const existingOutputs = edges.filter(e => e.source === source).length;
            if (existingOutputs >= srcLimit) {
                return {
                    valid: false,
                    reason: `Source node has reached maximum outputs (${srcLimit})`
                };
            }
        }

        return { valid: true };
    }

    /**
     * Checks if a node type can have more outputs.
     */
    canAddOutput(
        nodeId: string,
        nodes: NodeRef[],
        edges: EdgeRef[],
        nodeConfigs: Record<string, NodeConnectionConfig>
    ): boolean {
        const node = nodes.find(n => n.id === nodeId);
        if (!node) return false;

        const config = nodeConfigs[node.type];
        if (!config) return false;

        if (config.outputs === -1) return true;

        const existingOutputs = edges.filter(e => e.source === nodeId).length;
        return existingOutputs < config.outputs;
    }

    /**
     * Checks if a node type can have more inputs.
     */
    canAddInput(
        nodeId: string,
        nodes: NodeRef[],
        edges: EdgeRef[],
        nodeConfigs: Record<string, NodeConnectionConfig>
    ): boolean {
        const node = nodes.find(n => n.id === nodeId);
        if (!node) return false;

        const config = nodeConfigs[node.type];
        if (!config) return false;

        const limit = typeof config.inputs === 'number' ? config.inputs : 1;
        if (limit === -1) return true;

        const existingInputs = edges.filter(e => e.target === nodeId).length;
        return existingInputs < limit;
    }
}
