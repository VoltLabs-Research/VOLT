import mongoose, { Schema } from 'mongoose';
import { Persistable } from '@/src/shared/infrastructure/persistence/mongo/MongoUtils';
import { PluginProps, PluginStatus } from '@/src/modules/plugin/domain/entities/Plugin';
import { ValidationCodes } from '@/src/core/constants/validation-codes';
import { ArgumentType } from '@/src/modules/plugin/domain/entities/workflow/nodes/ArgumentNode';
import { Exporter, ExportType } from '@/src/modules/plugin/domain/entities/workflow/nodes/ExportNode';
import { ContextSource } from '@/src/modules/plugin/domain/entities/workflow/nodes/ContextNode';
import { IfStatementConditionHandler, IfStatementConditionType } from '@/src/modules/plugin/domain/entities/workflow/nodes/IfStatementNode';
import { WorkflowNodeType } from '@/src/modules/plugin/domain/entities/workflow/WorkflowNode';

type PluginRelations = 'team';
export interface PluginDocument extends Persistable<PluginProps, PluginRelations>, Document{}


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
        enum: Object.values(ContextSource),
        required: [true, ValidationCodes.PLUGIN_CONTEXT_SOURCE_REQUIRED],
        default: ContextSource.TrajectoryDumps
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
        enum: Object.values(IfStatementConditionType),
        default: IfStatementConditionType.And
    },
    leftExpr: {
        type: String,
        default: ''
    },
    handler: {
        type: String,
        enum: Object.values(IfStatementConditionHandler),
        default: IfStatementConditionHandler.IsEqualTo
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
        enum: Object.values(WorkflowNodeType),
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
        default: PluginStatus.Draft
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

PluginSchema.index({
    slug: 'text', 
    'modifier.name': 'text', 
    'modifier.description': 'text' 
});

const PluginModel = mongoose.model<PluginDocument>('Plugin', PluginSchema);

export default PluginModel;