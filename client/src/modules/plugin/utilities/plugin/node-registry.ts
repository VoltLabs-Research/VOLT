import { Exporter, ModifierContext, NodeType, ExportType_ as ExportType, ArgumentType, EntrypointType } from '@/modules/plugin/api/entities/plugin/workflow-enums';
import type { INodeData } from '@/modules/plugin/api/entities/plugin/workflow';
import { v4 } from 'uuid';
import type { Node } from '@xyflow/react';

interface NodePosition {
    x: number;
    y: number;
};

interface NodeOption<TValue> {
    value: TValue;
    label: string;
};

export interface AllowedNodeConnections {
    from: NodeType[];
    to: NodeType[];
};

export interface NodeTypeConfig {
    type: NodeType;
    label: string;
    icon: string;
    description: string;
    inputs: number;
    outputs: number;
    allowedConnections: AllowedNodeConnections;
};

export interface PluginNodeRegistryEntry extends NodeTypeConfig {
    createDefaultData: () => INodeData;
};

export const CONTEXT_OPTIONS: NodeOption<ModifierContext>[] = [{
    value: ModifierContext.TRAJECTORY_DUMPS,
    label: 'Trajectory Dumps'
}];

export const ARGUMENT_TYPE_OPTIONS: NodeOption<ArgumentType>[] = [{
    value: ArgumentType.STRING,
    label: 'String'
}, {
    value: ArgumentType.NUMBER,
    label: 'Number'
}, {
    value: ArgumentType.BOOLEAN,
    label: 'Boolean'
}, {
    value: ArgumentType.SELECT,
    label: 'Select'
}, {
    value: ArgumentType.FRAME,
    label: 'Frame'
}, {
    value: ArgumentType.LIST,
    label: 'List'
}, {
    value: ArgumentType.PLUGIN_REFERENCE,
    label: 'Plugin Reference'
}];

export const EXPORTER_OPTIONS: NodeOption<Exporter>[] = [{
    value: Exporter.ATOMISTIC,
    label: 'Atomistic Exporter'
}, {
    value: Exporter.MESH,
    label: 'Mesh Exporter'
}, {
    value: Exporter.DISLOCATION,
    label: 'Dislocation Exporter'
}, {
    value: Exporter.CHART,
    label: 'Chart Exporter'
}];

export const EXPORT_TYPE_OPTIONS: NodeOption<ExportType>[] = [{
    value: ExportType.GLB,
    label: 'GLB (3D Model)'
}, {
    value: ExportType.CHART_PNG,
    label: 'Chart (PNG Image)'
}];

export const NODE_REGISTRY: Record<NodeType, PluginNodeRegistryEntry> = {
    [NodeType.MODIFIER]: {
        type: NodeType.MODIFIER,
        label: 'Modifier',
        icon: 'TbPlugConnected',
        description: 'Plugin metadata and configuration',
        inputs: 0,
        outputs: 1,
        allowedConnections: {
            from: [],
            to: [NodeType.ARGUMENTS]
        },
        createDefaultData: () => ({
            modifier: {
                name: 'New Plugin',
                icon: '',
                author: '',
                license: 'MIT',
                version: '1.0.0',
                homepage: '',
                description: ''
            }
        })
    },
    [NodeType.ARGUMENTS]: {
        type: NodeType.ARGUMENTS,
        label: 'Arguments',
        icon: 'TbBrackets',
        description: 'CLI arguments definition',
        inputs: 1,
        outputs: 1,
        allowedConnections: {
            from: [NodeType.MODIFIER],
            to: [NodeType.CONTEXT]
        },
        createDefaultData: () => ({
            arguments: {
                arguments: []
            }
        })
    },
    [NodeType.CONTEXT]: {
        type: NodeType.CONTEXT,
        label: 'Context',
        icon: 'TbDatabase',
        description: 'Data source selection',
        inputs: 1,
        outputs: 1,
        allowedConnections: {
            from: [NodeType.ARGUMENTS],
            to: [NodeType.FOREACH, NodeType.ENTRYPOINT, NodeType.PLUGIN]
        },
        createDefaultData: () => ({
            context: {
                source: ModifierContext.TRAJECTORY_DUMPS
            }
        })
    },
    [NodeType.FOREACH]: {
        type: NodeType.FOREACH,
        label: 'ForEach',
        icon: 'TbRepeat',
        description: 'Iterate over data source',
        inputs: 1,
        outputs: 1,
        allowedConnections: {
            from: [NodeType.CONTEXT],
            to: [NodeType.ENTRYPOINT, NodeType.PLUGIN]
        },
        createDefaultData: () => ({
            forEach: {
                iterableSource: 'context.trajectory_dumps'
            }
        })
    },
    [NodeType.ENTRYPOINT]: {
        type: NodeType.ENTRYPOINT,
        label: 'Entrypoint',
        icon: 'TbPlayerPlay',
        description: 'Binary execution',
        inputs: 1,
        outputs: -1,
        allowedConnections: {
            from: [NodeType.CONTEXT, NodeType.FOREACH, NodeType.PLUGIN],
            to: [NodeType.EXPOSURE, NodeType.IF_STATEMENT]
        },
        createDefaultData: () => ({
            entrypoint: {
                binary: '',
                type: EntrypointType.EXECUTABLE,
                arguments: '{{ context.outputPath }} {{ context.allDumpLocalPaths }} {{ arguments.as_str }}',
                requirementsFile: '',
                timeout: -1
            }
        })
    },
    [NodeType.PLUGIN]: {
        type: NodeType.PLUGIN,
        label: 'Plugin Node',
        icon: 'TbPlugConnectedX',
        description: 'Execute a published plugin inline',
        inputs: 1,
        outputs: -1,
        allowedConnections: {
            from: [NodeType.FOREACH, NodeType.PLUGIN],
            to: [NodeType.PLUGIN, NodeType.ENTRYPOINT]
        },
        createDefaultData: () => ({
            pluginNode: {
                pluginId: '',
                selectedTeamClusterId: '',
                selectedTimesteps: undefined,
                config: {}
            }
        })
    },
    [NodeType.EXPOSURE]: {
        type: NodeType.EXPOSURE,
        label: 'Exposure',
        icon: 'TbEye',
        description: 'Results exposure',
        inputs: 1,
        outputs: 1,
        allowedConnections: {
            from: [NodeType.ENTRYPOINT],
            to: [NodeType.EXPORT]
        },
        createDefaultData: () => ({
            exposure: {
                name: '',
                results: '',
                canvas: false,
                raster: false,
                iterable: ''
            }
        })
    },
    [NodeType.EXPORT]: {
        type: NodeType.EXPORT,
        label: 'Export',
        icon: 'TbFileExport',
        description: 'Export to GLB/other formats',
        inputs: 1,
        outputs: 0,
        allowedConnections: {
            from: [NodeType.EXPOSURE],
            to: []
        },
        createDefaultData: () => ({
            export: {
                exporter: Exporter.ATOMISTIC,
                type: ExportType.GLB,
                options: {}
            }
        })
    },
    [NodeType.IF_STATEMENT]: {
        type: NodeType.IF_STATEMENT,
        label: 'If Statement',
        icon: 'TbGitBranch',
        description: 'Conditional branching',
        inputs: 1,
        outputs: 2,
        allowedConnections: {
            from: [NodeType.ENTRYPOINT, NodeType.FOREACH, NodeType.CONTEXT],
            to: [NodeType.ENTRYPOINT, NodeType.EXPOSURE, NodeType.EXPORT]
        },
        createDefaultData: () => ({
            ifStatement: {
                conditions: []
            }
        })
    }
};

export const NODE_CONFIGS: Record<NodeType, NodeTypeConfig> = NODE_REGISTRY;

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
    return NODE_REGISTRY[type]?.createDefaultData() ?? {};
};
