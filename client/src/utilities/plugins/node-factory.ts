import { Exporter, ModifierContext, NodeType } from '@/types/plugin';
import type { Node } from 'reactflow';
import { NODE_CONFIGS } from '@/utilities/plugins/node-types';

let nodeIdCounter = 0;

export const generateNodeId = (type: NodeType): string => {
    nodeIdCounter++;
    return `${type}-${nodeIdCounter}-${Date.now()}`;
};

export const createNode = (type: NodeType, position: { x: number; y: number }): Node => {
    const id = generateNodeId(type);
    const config = NODE_CONFIGS[type];

    return {
        id,
        type,
        position,
        data: {
            name: `${config.label}_${nodeIdCounter}`,
            ...getDefaultDataForType(type)
        }
    };
};

export const getDefaultDataForType = (type: NodeType): Record<string, any> => {
    switch(type){
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
                    arguments: '{ forEach.currentValue }} {{ forEach.outputPath }} {{ arguments.as_str }}',
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

        default:
            return {};
    }
};

export const resetNodeIdCounter = (): void => {
    nodeIdCounter = 0;
};