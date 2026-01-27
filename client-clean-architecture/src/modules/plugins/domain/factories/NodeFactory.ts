import { NodeType, Exporter, ModifierContext } from '../entities';

export { NodeType };

/**
 * Position for a node.
 */
export interface NodePosition {
    x: number;
    y: number;
}

/**
 * Node data structure.
 */
export interface WorkflowNode {
    id: string;
    type: NodeType;
    position: NodePosition;
    data: Record<string, any>;
}



/**
 * Factory for creating workflow nodes.
 * Pure domain logic - no external dependencies except ID generation.
 */
export class NodeFactory {
    /**
     * Creates a new node with default data for the type.
     *
     * @param type - Node type
     * @param position - Node position
     * @param generateId - Function to generate unique ID
     * @returns New workflow node
     */
    createNode(
        type: NodeType,
        position: NodePosition,
        generateId: () => string
    ): WorkflowNode {
        return {
            id: generateId(),
            type,
            position,
            data: { ...this.getDefaultDataForType(type) }
        };
    }

    /**
     * Gets default data for a node type.
     * Pure function - deterministic output for each type.
     */
    getDefaultDataForType(type: NodeType): Record<string, any> {
        switch (type) {
            case NodeType.MODIFIER:
                return {
                    modifier: {
                        name: '',
                        icon: '',
                        author: '',
                        license: 'MIT',
                        version: '1.0.0',
                        homepage: '',
                        description: ''
                    }
                };

            case NodeType.ARGUMENTS:
                return {
                    arguments: {
                        arguments: []
                    }
                };

            case NodeType.CONTEXT:
                return {
                    context: {
                        source: ModifierContext.TRAJECTORY_DUMPS
                    }
                };

            case NodeType.FOREACH:
                return {
                    forEach: {
                        iterableSource: 'context.trajectory_dumps'
                    }
                };

            case NodeType.ENTRYPOINT:
                return {
                    entrypoint: {
                        binary: '',
                        arguments: '{{ forEach.currentValue }} {{ forEach.outputPath }} {{ arguments.as_str }}',
                        timeout: -1
                    }
                };

            case NodeType.EXPOSURE:
                return {
                    exposure: {
                        name: '',
                        results: '',
                        iterable: ''
                    }
                };

            case NodeType.SCHEMA:
                return {
                    schema: {
                        definition: {}
                    }
                };

            case NodeType.VISUALIZERS:
                return {
                    visualizers: {
                        canvas: false,
                        raster: false,
                        listing: {}
                    }
                };

            case NodeType.EXPORT:
                return {
                    export: {
                        exporter: Exporter.ATOMISTIC,
                        type: 'glb',
                        options: {}
                    }
                };

            case NodeType.IF_STATEMENT:
                return {
                    ifStatement: {
                        conditions: []
                    }
                };

            default:
                return {};
        }
    }
}
