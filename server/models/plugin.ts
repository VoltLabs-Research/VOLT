import { IPlugin, IPluginModel, IWorkflow, IWorkflowNode } from '@/types/models/modifier';
import mongoose, { Schema } from 'mongoose';

export enum NodeType{
    MODIFIER = 'modifier',
    ARGUMENTS = 'arguments',
    CONTEXT = 'context',
    FOREACH = 'forEach',
    ENTRYPOINT = 'entrypoint',
    EXPOSURE = 'exposure',
    SCHEMA = 'schema',
    VISUALIZERS = 'visualizers',
    EXPORT = 'export'
};

export enum ArgumentType{
    SELECT = 'select',
    NUMBER = 'number',
    FRAME = 'frame',
    BOOLEAN = 'boolean',
    STRING = 'string'
};

export enum ModifierContext{
    TRAJECTORY_DUMPS = 'trajectory_dumps'
};

export enum Exporter{
    ATOMISTIC = 'AtomisticExporter',
    MESH = 'MeshExporter',
    DISLOCATION = 'DislocationExporter'
};

export enum ExportType{
    GLB = 'glb'
};

export enum PluginStatus{
    DRAFT = 'draft',
    PUBLISHED = 'published',
    DISABLED = 'disabled'
};

const ArgumentOptionSchema = new Schema({
    key: {
        type: String,
        required: true
    },
    label: {
        type: String,
        required: true
    }
}, { _id: false });

const ArgumentDefinitionSchema = new Schema({
    argument: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: Object.values(ArgumentType),
        required: true
    },
    label: {
        type: String,
        required: true
    },
    default: {
        type: Schema.Types.Mixed
    },
    value: {
        type: Schema.Types.Mixed
    },
    options: [ArgumentOptionSchema],
    min: {
        type: Number
    },
    max: {
        type: Number
    },
    step: {
        type: Number
    }
}, { _id: false });

const ModifierDataSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    icon: {
        type: String
    },
    author: {
        type: String
    },
    license: {
        type: String,
        default: 'MIT'
    },
    version: {
        type: String,
        default: '1.0.0'
    },
    homepage: {
        type: String
    },
    description: {
        type: String
    }
}, { _id: false });

const ArgumentsDataSchema = new Schema({
    arguments: [ArgumentDefinitionSchema]
}, { _id: false });

const ContextDataSchema = new Schema({
    source: {
        type: String,
        enum: Object.values(ModifierContext),
        required: true,
        default: ModifierContext.TRAJECTORY_DUMPS
    }
}, { _id: false });

const ForEachDataSchema = new Schema({
    iterableSource: {
        type: String,
        required: true
    }
}, { _id: false });

const EntrypointDataSchema = new Schema({
    binary: {
        type: String,
        required: true
    },
    arguments: {
        type: String,
        required: true
    },
    timeout: {
        type: Number,
        default: 300000
    }
}, { _id: false });

const ExposureDataSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    results: {
        type: String,
        required: true
    },
    iterable: {
        type: String
    }
});

const SchemaDataSchema = new Schema({
    definition: {
        type: Schema.Types.Mixed,
        required: true
    } 
});

const VisualizersDataSchema = new Schema({
    canvas: {
        type: Boolean,
        default: false
    },
    raster: {
        type: Boolean,
        default: false
    },
    listing: {
        type: Schema.Types.Mixed
    }
}, { _id: false });

const ExportDataSchema = new Schema({
    exporter: {
        type: String,
        enum: Object.values(Exporter),
        required: true
    },
    type: {
        type: String,
        enum: Object.values(ExportType),
        required: true
    },
    options: {
        type: Schema.Types.Mixed,
        default: {}
    }
}, { _id: false });

const PositionSchema = new Schema({
    x: {
        type: Number,
        required: true,
        default: 0
    },
    y: {
        type: Number,
        required: true,
        default: 0
    }
});

const NodeDataSchema = new Schema({
    modifier: ModifierDataSchema,
    arguments: ArgumentDefinitionSchema,
    context: ContextDataSchema,
    forEach: ForEachDataSchema,
    entrypoint: EntrypointDataSchema,
    exposure: ExposureDataSchema,
    schema: SchemaDataSchema,
    visualizers: VisualizersDataSchema,
    export: ExportDataSchema
}, { _id: false });

const WorkflowNodeSchema = new Schema({
    id: {
        type: String,
        required: true
    },
    name: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: Object.values(NodeType),
        required: true
    },
    position: {
        type: PositionSchema,
        required: true
    },
    data: {
        type: NodeDataSchema,
        default: {}
    }
}, { _id: false });

const WorkflowEdgeSchema = new Schema({
    id: {
        type: String,
        required: true
    },
    source: {
        type: String,
        required: true
    },
    sourceHandle: {
        type: String
    },
    target: {
        type: String,
        required: true
    },
    targetHandle: {
        type: String
    }
}, { _id: false });

const ViewportSchema = new Schema({
    x: {
        type: Number,
        default: 0
    },
    y: {
        type: Number,
        default: 0
    },
    zoom: {
        type: Number,
        default: 1
    }
}, { _id: false });

const WorkflowSchema = new Schema({
    nodes: [WorkflowNodeSchema],
    edges: [WorkflowEdgeSchema],
    viewport: {
        type: ViewportSchema,
        default: {}
    }
}, { _id: false });

const PluginSchema = new Schema({
    slug: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        index: true
    },
    workflow: {
        type: WorkflowSchema,
        required: true
    },
    status: {
        type: String,
        enum: Object.values(PluginStatus),
        default: PluginStatus.DRAFT
    },
    validated: {
        type: Boolean,
        default: false
    },
    validationErrors: [{
        type: String
    }]
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

PluginSchema.index({ slug: 1 }, { unique: true });
PluginSchema.index({ status: 1 });
PluginSchema.index({ createdBy: 1 });
PluginSchema.index({ createdAt: -1 });

PluginSchema.statics.getNodeById = function(workflow: IWorkflow, nodeId: string): IWorkflowNode | undefined{
    return workflow.nodes.find((node) => node.id === nodeId);
};

PluginSchema.statics.getNodeByName = function(workflow: IWorkflow, name: string): IWorkflowNode | undefined{
    return workflow.nodes.find((node) => node.name === name);
};

PluginSchema.statics.getChildNodes = function(workflow: IWorkflow, nodeId: string): IWorkflowNode[]{
    const childIds = workflow.edges.filter((edge) => edge.source === nodeId).map((edge) => edge.target);
    return workflow.nodes.filter((node) => childIds.includes(node.id));
};

PluginSchema.statics.getParentNodes = function(workflow: IWorkflow, nodeId: string): IWorkflowNode[]{
    const parentIds = workflow.edges.filter((edge) => edge.target === nodeId).map((edge) => edge.source);
    return workflow.nodes.filter((node) => parentIds.includes(node.id));
};

PluginSchema.statics.getNodesByType = function(workflow: IWorkflow, type: NodeType): IWorkflowNode[]{
    return workflow.nodes.filter((node) => node.type === type);
};

PluginSchema.virtual('modifier').get(function(){
    const modifierNode = this.workflow?.nodes?.find((node) => node.type === NodeType.MODIFIER);
    return modifierNode?.data?.modifier || null;
});

PluginSchema.virtual('exposures').get(function(){
    return this.workflow?.nodes?.filter((node) => node.type === NodeType.EXPOSURE)
        ?.map((node) => ({
            nodeId: node.id,
            nodeName: node.name,
            ...node.data?.exposure
        }));
});

const Plugin = mongoose.model<IPlugin, IPluginModel>('Plugin', PluginSchema);

export default Plugin;