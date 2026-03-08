import { Exporter, ModifierContext, NodeType, ExportType_ as ExportType } from '@/modules/plugin/api/entities/plugin/workflow-enums';
import type { INodeData } from '@/modules/plugin/api/entities/plugin/workflow';
import { v4 } from 'uuid';
import type { Node } from '@xyflow/react';

interface NodePosition {
    x: number;
    y: number;
};

export const createNode = (type: NodeType, position: NodePosition): Node<INodeData> => {
    const id = v4();

    return {
        id,
        type,
        position,
        data: { ...getDefaultDataForType(type) }
    };
};

export const getDefaultDataForType = (type: NodeType): INodeData => {
    switch (type) {
        case NodeType.MODIFIER:
            return {
                modifier: {
                    name: 'New Plugin',
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
                    canvas: false,
                    raster: false,
                    iterable: ''
                }
            };

        case NodeType.EXPORT:
            return {
                export: {
                    exporter: Exporter.ATOMISTIC,
                    type: ExportType.GLB,
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
};
