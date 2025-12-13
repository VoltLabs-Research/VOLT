import type { Component, ComponentType } from 'react';
import type { NodeProps, Node } from '@xyflow/react';
import { NodeType, type INodeData } from '@/types/plugin';

/**
 * Configuration for node connections and UI
 */
export interface NodeTypeConfig{
    type: NodeType;
    label: string;
    icon: string;
    description: string;
    inputs: number;
    outputs: number;
    allowedConnections: {
        from: NodeType[];
        to: NodeType[];
    };
};

/**
 * Complete node definition including component, editor, and defaults
 */
export interface NodeDefinition{
    type: NodeType;
    config: NodeTypeConfig;
    component: ComponentType<NodeProps>;
    editor: ComponentType<{ node: Node }>;
    getDefaultData: () => Partial<INodeData>;
}

/**
 * Registry for all node definitions
 */
class NodeRegistry{
    private definitions = new Map<NodeType, NodeDefinition>();

    /**
     * Register a node definition
     */
    register(definition: NodeDefinition): void{
        this.definitions.set(definition.type, definition);
    }

    /**
     * Get definition for a node type
     */
    get(type: NodeType): NodeDefinition | undefined{
        return this.definitions.get(type);
    }

    /**
     * Get config for a node type
     */
    getConfig(type: NodeType): NodeTypeConfig | undefined{
        return this.definitions.get(type)?.config;
    }

    /**
     * Get default data for a node type
     */
    getDefaultData(type: NodeType): Partial<INodeData>{
        const def = this.definitions.get(type);
        return def?.getDefaultData() ?? {};
    }

    /**
     * Get all node types for ReactFlow
     */
    getNodeTypes(): Record<string, ComponentType<NodeProps>>{
        const result: Record<string, ComponentType<NodeProps>> = {};
        for(const [type, def] of this.definitions){
            result[type] = def.component;
        }
        return result;
    }

    /**
     * Get editor component for a node type
     */
    getEditor(type: NodeType): ComponentType<{ node: Node }> | undefined{
        return this.definitions.get(type)?.editor;
    }

    /**
     * Check if type is registered
     */
    has(type: NodeType): boolean{
        return this.definitions.has(type);
    }

    /**
     * Get all registered types
     */
    getTypes(): NodeType[]{
        return Array.from(this.definitions.keys());
    }
};

const nodeRegistry = new NodeRegistry();

export default nodeRegistry;
