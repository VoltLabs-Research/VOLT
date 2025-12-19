import { NodeType, ArgumentType, ModifierContext, Exporter, ExportType } from '@/types/plugin';

export interface NodeTypeConfig {
    type: NodeType;
    label: string;
    icon: string;
    description: string;
    inputs: number;
    outputs: number;
    allowedConnections: {
        from: NodeType[];
        to: NodeType[];
    }
};

export const NODE_CONFIGS: Record<NodeType, NodeTypeConfig> = {
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
        }
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
        }
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
            to: [NodeType.FOREACH]
        }
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
            to: [NodeType.ENTRYPOINT]
        }
    },
    [NodeType.ENTRYPOINT]: {
        type: NodeType.ENTRYPOINT,
        label: 'Entrypoint',
        icon: 'TbPlayerPlay',
        description: 'Binary execution',
        inputs: 1,
        outputs: -1,
        allowedConnections: {
            from: [NodeType.FOREACH],
            to: [NodeType.EXPOSURE]
        }
    },
    [NodeType.EXPOSURE]: {
        type: NodeType.EXPOSURE,
        label: 'Exposure',
        icon: 'TbEye',
        description: 'Results exposure',
        inputs: 1,
        outputs: 2,
        allowedConnections: {
            from: [NodeType.ENTRYPOINT],
            to: [NodeType.SCHEMA, NodeType.EXPORT, NodeType.VISUALIZERS]
        }
    },
    [NodeType.SCHEMA]: {
        type: NodeType.SCHEMA,
        label: 'Schema',
        icon: 'TbSchema',
        description: 'Data structure definition',
        inputs: 1,
        outputs: 1,
        allowedConnections: {
            from: [NodeType.EXPOSURE],
            to: [NodeType.VISUALIZERS]
        }
    },
    [NodeType.VISUALIZERS]: {
        type: NodeType.VISUALIZERS,
        label: 'Visualizers',
        icon: 'TbChartDots3',
        description: 'Visualization configuration',
        inputs: 1,
        outputs: 1,
        allowedConnections: {
            from: [NodeType.SCHEMA],
            to: [NodeType.EXPORT]
        }
    },
    [NodeType.EXPORT]: {
        type: NodeType.EXPORT,
        label: 'Export',
        icon: 'TbFileExport',
        description: 'Export to GLB/other formats',
        inputs: 1,
        outputs: 0,
        allowedConnections: {
            from: [NodeType.EXPOSURE, NodeType.VISUALIZERS],
            to: []
        }
    }
};

export const CONTEXT_OPTIONS = [{
    value: ModifierContext.TRAJECTORY_DUMPS,
    label: 'Trajectory Dumps'
}];

export const ARGUMENT_TYPE_OPTIONS = [{
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
}];

export const EXPORTER_OPTIONS = [{
    value: Exporter.ATOMISTIC,
    label: 'Atomistic Exporter'
}, {
    value: Exporter.MESH,
    label: 'Mesh Exporter'
}, {
    value: Exporter.DISLOCATION,
    label: 'Dislocation Exporter'
}];

export const EXPORT_TYPE_OPTIONS = [{
    value: ExportType.GLB,
    label: 'GLB(3D Model)'
}];
