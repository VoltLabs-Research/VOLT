import { ValidationCodes } from '@/constants/validation-codes';
import { IPlugin, IPluginModel, IWorkflow, IWorkflowNode } from '@/types/models/modifier';
import { ArgumentType, NodeType, ModifierContext, Exporter, ExportType, PluginStatus, ConditionType, ConditionHandler } from '@/types/models/plugin';
import mongoose, { Schema } from 'mongoose';
import useCascadeDelete from '@/utilities/mongo/cascade-delete';
import useInverseRelations from '@/utilities/mongo/inverse-relations';
import storage from '@/services/storage';
import { SYS_BUCKETS } from '@/config/minio';
import logger from '@/logger';

const ArgumentOptionSchema = new Schema({
    key: {
        type: String,
        required: [true, ValidationCodes.PLUGIN_ARGUMENT_OPT_KEY_REQUIRED]
    },
    label: {
        type: String,
        required: [true, ValidationCodes.PLUGIN_ARGUMENT_OPT_LABEL_REQUIRED]
    }
}, { _id: false });

const ArgumentDefinitionSchema = new Schema({
    argument: {
        type: String,
        required: [true, ValidationCodes.PLUGIN_ARGUMENT_DEF_ARGUMENT_REQUIRED]
    },
    type: {
        type: String,
        enum: Object.values(ArgumentType),
        required: [true, ValidationCodes.PLUGIN_ARGUMENT_DEF_TYPE_REQUIRED]
    },
    label: {
        type: String,
        required: [true, ValidationCodes.PLUGIN_ARGUMENT_DEF_LABEL_REQUIRED]
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
        required: [true, ValidationCodes.PLUGIN_MODIFIER_NAME_REQUIRED]
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
        required: [true, ValidationCodes.PLUGIN_CONTEXT_SOURCE_REQUIRED],
        default: ModifierContext.TRAJECTORY_DUMPS
    }
}, { _id: false });

const ForEachDataSchema = new Schema({
    iterableSource: {
        type: String,
        required: [true, ValidationCodes.PLUGIN_FOREACH_ITERABLE_SOURCE_REQUIRED]
    }
}, { _id: false });

const EntrypointDataSchema = new Schema({
    binary: {
        type: String
    },
    // MinIO object path for the uploaded binary
    binaryObjectPath: {
        type: String
    },
    // Original filename when uploaded
    binaryFileName: {
        type: String
    },
    // SHA256 hash of binary for caching
    binaryHash: {
        type: String
    },
    arguments: {
        type: String
    },
    timeout: {
        type: Number,
        default: 300000
    }
}, { _id: false });

const ExposureDataSchema = new Schema({
    name: {
        type: String,
        required: [true, ValidationCodes.PLUGIN_EXPOSURE_NAME_REQUIRED]
    },
    icon: {
        type: String
    },
    results: {
        type: String,
        required: [true, ValidationCodes.PLUGIN_EXPOSURE_RESULTS_REQUIRED]
    },
    iterable: {
        type: String
    },
    iterableChunkSize: {
        type: Number,
        min: 1
    }
});

const SchemaDataSchema = new Schema({
    definition: {
        type: Schema.Types.Mixed,
        required: [true, ValidationCodes.PLUGIN_SCHEMA_DEFINITION_REQUIRED]
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
    listingTitle: {
        type: String,
        default: ''
    },
    listing: {
        type: Schema.Types.Mixed
    },
    perAtomProperties: {
        type: [String],
        default: []
    }
}, { _id: false });

const ExportDataSchema = new Schema({
    exporter: {
        type: String,
        enum: Object.values(Exporter),
        required: [true, ValidationCodes.PLUGIN_EXPORT_EXPORTER_REQUIRED]
    },
    type: {
        type: String,
        enum: Object.values(ExportType),
        required: [true, ValidationCodes.PLUGIN_EXPORT_TYPE_REQUIRED]
    },
    options: {
        type: Schema.Types.Mixed,
        default: {}
    }
}, { _id: false });

const PositionSchema = new Schema({
    x: {
        type: Number,
        required: [true, ValidationCodes.PLUGIN_POSITION_X_REQUIRED],
        default: 0
    },
    y: {
        type: Number,
        required: [true, ValidationCodes.PLUGIN_POSITION_Y_REQUIRED],
        default: 0
    }
});

const ConditionSchema = new Schema({
    type: {
        type: String,
        enum: Object.values(ConditionType),
        default: ConditionType.AND
    },
    leftExpr: {
        type: String,
        default: ''
    },
    handler: {
        type: String,
        enum: Object.values(ConditionHandler),
        default: ConditionHandler.IS_EQUAL_TO
    },
    rightExpr: {
        type: String,
        default: ''
    }
}, { _id: false });

const IfStatementDataSchema = new Schema({
    conditions: [ConditionSchema]
}, { _id: false });

const NodeDataSchema = new Schema({
    modifier: ModifierDataSchema,
    arguments: ArgumentsDataSchema,
    context: ContextDataSchema,
    forEach: ForEachDataSchema,
    entrypoint: EntrypointDataSchema,
    exposure: ExposureDataSchema,
    schema: SchemaDataSchema,
    visualizers: VisualizersDataSchema,
    export: ExportDataSchema,
    ifStatement: IfStatementDataSchema
}, { _id: false });

const WorkflowNodeSchema = new Schema({
    id: {
        type: String,
        required: [true, ValidationCodes.PLUGIN_WORKFLOW_NODE_ID_REQUIRED]
    },
    type: {
        type: String,
        enum: Object.values(NodeType),
        required: [true, ValidationCodes.PLUGIN_WORKFLOW_NODE_TYPE_REQUIRED]
    },
    position: {
        type: PositionSchema,
        required: [true, ValidationCodes.PLUGIN_WORKFLOW_NODE_POSITION_REQUIRED]
    },
    data: {
        type: NodeDataSchema,
        default: {}
    }
}, { _id: false });

const WorkflowEdgeSchema = new Schema({
    id: {
        type: String,
        required: [true, ValidationCodes.PLUGIN_WORKFLOW_EDGE_ID_REQUIRED]
    },
    source: {
        type: String,
        required: [true, ValidationCodes.PLUGIN_WORKFLOW_EDGE_SOURCE_REQUIRED]
    },
    sourceHandle: {
        type: String
    },
    target: {
        type: String,
        required: [true, ValidationCodes.PLUGIN_WORKFLOW_EDGE_TARGET_REQUIRED]
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
    team: {
        type: Schema.Types.ObjectId,
        ref: 'Team',
        required: true,
        cascade: 'delete',
        inverse: { path: 'plugins', behavior: 'addToSet' }
    },
    slug: {
        type: String,
        required: [true, ValidationCodes.PLUGIN_SLUG_REQUIRED],
        unique: true,
        lowercase: true,
        trim: true
    },
    workflow: {
        type: WorkflowSchema,
        required: [true, ValidationCodes.PLUGIN_WORKFLOW_REQUIRED]
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

PluginSchema.index({ slug: 'text', 'modifier.name': 'text', 'modifier.description': 'text' });

PluginSchema.plugin(useInverseRelations);
PluginSchema.plugin(useCascadeDelete);

/**
 * Safely delete plugin binary from MinIO only if no other plugin shares the same binaryHash.
 * This allows multiple teams to share the same binary file.
 */
const safelyDeletePluginBinary = async (plugin: any): Promise<void> => {
    const entrypointNode = plugin.workflow?.nodes?.find(
        (n: IWorkflowNode) => n.type === NodeType.ENTRYPOINT
    );

    const binaryObjectPath = entrypointNode?.data?.entrypoint?.binaryObjectPath;
    const binaryHash = entrypointNode?.data?.entrypoint?.binaryHash;

    if (!binaryObjectPath) return;

    // If there's a hash, check if another plugin uses the same binary
    if (binaryHash) {
        const otherPluginsWithSameHash = await mongoose.model('Plugin').countDocuments({
            _id: { $ne: plugin._id },
            'workflow.nodes': {
                $elemMatch: {
                    type: NodeType.ENTRYPOINT,
                    'data.entrypoint.binaryHash': binaryHash
                }
            }
        });

        if (otherPluginsWithSameHash > 0) {
            logger.info(`[Plugin] Binary ${binaryObjectPath} is shared by ${otherPluginsWithSameHash} other plugin(s), skipping deletion`);
            return;
        }
    }

    // Delete binary from MinIO
    try {
        await storage.delete(SYS_BUCKETS.PLUGINS, binaryObjectPath);
        logger.info(`[Plugin] Deleted binary: ${binaryObjectPath}`);
    } catch (err) {
        // Log but don't fail plugin deletion
        logger.warn(`[Plugin] Could not delete binary ${binaryObjectPath}: ${err}`);
    }
};

// Pre-delete hook for document.deleteOne()
PluginSchema.pre('deleteOne', { document: true, query: false }, async function (next) {
    await safelyDeletePluginBinary(this);
    next();
});

// Pre-delete hook for Model.findOneAndDelete()
PluginSchema.pre('findOneAndDelete', { document: false, query: true }, async function (next) {
    const doc = await this.model.findOne(this.getFilter());
    if (doc) {
        await safelyDeletePluginBinary(doc);
    }
    next();
});

PluginSchema.index({ status: 1 });
PluginSchema.index({ createdBy: 1 });
PluginSchema.index({ createdAt: -1 });

PluginSchema.statics.getNodeById = function (workflow: IWorkflow, nodeId: string): IWorkflowNode | undefined {
    return workflow.nodes.find((node) => node.id === nodeId);
};

PluginSchema.statics.getChildNodes = function (workflow: IWorkflow, nodeId: string): IWorkflowNode[] {
    const childIds = workflow.edges.filter((edge) => edge.source === nodeId).map((edge) => edge.target);
    return workflow.nodes.filter((node) => childIds.includes(node.id));
};

PluginSchema.statics.getParentNodes = function (workflow: IWorkflow, nodeId: string): IWorkflowNode[] {
    const parentIds = workflow.edges.filter((edge) => edge.target === nodeId).map((edge) => edge.source);
    return workflow.nodes.filter((node) => parentIds.includes(node.id));
};

PluginSchema.statics.getNodesByType = function (workflow: IWorkflow, type: NodeType): IWorkflowNode[] {
    return workflow.nodes.filter((node) => node.type === type);
};

PluginSchema.virtual('modifier').get(function () {
    const modifierNode = this.workflow?.nodes?.find((node) => node.type === NodeType.MODIFIER);
    return modifierNode?.data?.modifier || null;
});

// Helper to find a descendant node by type
const findDescendantByType = (workflow: IWorkflow, nodeId: string, type: NodeType): IWorkflowNode | null => {
    if (!workflow.edges || !workflow.nodes) return null;

    const visited = new Set<string>();
    const queue = [nodeId];

    while (queue.length > 0) {
        const currentId = queue.shift()!;
        if (visited.has(currentId)) continue;
        visited.add(currentId);

        const childEdges = workflow.edges.filter((edge) => edge.source === currentId);
        for (const edge of childEdges) {
            const childNode = workflow.nodes.find((node) => node.id === edge.target);
            if (childNode?.type === type) return childNode;
            if (childNode) queue.push(edge.target);
        }
    }
    return null;
};

PluginSchema.virtual('exposures').get(function () {
    if (!this.workflow?.nodes) return [];

    return this.workflow.nodes
        .filter((node) => node.type === NodeType.EXPOSURE)
        .map((node) => {
            const visualizersNode = findDescendantByType(this.workflow as any, node.id, NodeType.VISUALIZERS);
            const exportNode = findDescendantByType(this.workflow as any, node.id, NodeType.EXPORT);

            return {
                nodeId: node.id,
                ...node.data?.exposure,
                visualizers: visualizersNode?.data?.visualizers,
                export: exportNode?.data?.export
            };
        });
});

PluginSchema.virtual('arguments').get(function () {
    const argumentsNode = this.workflow?.nodes?.find((node) => node.type === NodeType.ARGUMENTS);
    return argumentsNode?.data?.arguments?.arguments || [];
});

const Plugin = mongoose.model<IPlugin, IPluginModel>('Plugin', PluginSchema);

export default Plugin;
