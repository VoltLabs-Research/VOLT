import type {
    NodeType,
    ArgumentType,
    ArgumentVisibilityOperator,
    ModifierContext,
    EntrypointType,
    Exporter,
    ExportType_,
    ConditionType,
    ConditionHandler,
    PluginNodeExecutionMode,
    PluginNodeOutputPathMode
} from '@/modules/plugin/api/entities/plugin/workflow-enums';

export interface IWorkflow {
    nodes: IWorkflowNode[];
    edges: IWorkflowEdge[];
    viewport?: IViewport;
};

export interface IViewport {
    x: number;
    y: number;
    zoom: number;
};

export interface IWorkflowNode {
    id: string;
    type: NodeType;
    position: IPosition;
    data: INodeData;
};

export interface IPosition {
    x: number;
    y: number;
};

export type NodeConnectorSide = 'left' | 'right' | 'top' | 'bottom';

export interface INodeConnectorPlacement {
    side: NodeConnectorSide;
    offset: number;
};

export interface INodeConnectorLayout {
    [handleId: string]: INodeConnectorPlacement;
};

export interface IWorkflowEdge {
    id: string;
    source: string;
    sourceHandle?: string;
    target: string;
    targetHandle?: string;
};

export interface IArgumentOption {
    key: string;
    label: string;
};

export interface IArgumentVisibilityCondition {
    argument: string;
    operator: ArgumentVisibilityOperator;
    value?: string | number | boolean;
    values?: Array<string | number | boolean>;
};

export interface IArgumentDefinition {
    argument: string;
    type: ArgumentType;
    label: string;
    default?: unknown;
    value?: unknown;
    options?: IArgumentOption[];
    listArguments?: IArgumentDefinition[];
    required?: boolean;
    multipleSelection?: boolean;
    pluginReferenceFilter?: string[];
    pluginReferenceFilterKeys?: string[];
    showPluginConfiguration?: boolean;
    min?: number;
    max?: number;
    step?: number;
    visibleWhen?: IArgumentVisibilityCondition;
};

export interface IPluginReferenceSelection {
    pluginId: string;
    config?: Record<string, unknown>;
};

export interface IPluginReferenceValue {
    selections: IPluginReferenceSelection[];
};

export interface IModifierData {
    key?: string;
    name: string;
    author?: string;
    license?: string;
    version?: string;
    homepage?: string;
    description?: string;
};

export interface IArgumentsData {
    arguments: IArgumentDefinition[];
};

export interface IContextData {
    source: ModifierContext;
    [key: string]: unknown;
};

export interface IForEachData {
    iterableSource: string;
    [key: string]: unknown;
};

export interface IEntrypointData {
    binary: string;
    binaryObjectPath?: string;
    binaryFileName?: string;
    binaryHash?: string;
    type?: EntrypointType;
    arguments: string;
    requirementsFile?: string;
    entrypointScript?: string;
};

export interface IPluginNodeData {
    executionMode?: PluginNodeExecutionMode;
    outputPathMode?: PluginNodeOutputPathMode;
    pluginId?: string;
    argumentReference?: string;
    selectedTeamClusterId?: string;
    selectedTimesteps?: number[];
    config?: Record<string, unknown>;
    configByPluginId?: Record<string, Record<string, unknown>>;
};

export interface IExposureData {
    name: string;
    icon?: string;
    results: string;
    [key: string]: unknown;
};

export interface IExportData {
    exporter: Exporter;
    type: ExportType_;
    options?: Record<string, unknown>;
};

export interface ICondition {
    type: ConditionType;
    leftExpr: string;
    handler: ConditionHandler;
    rightExpr: string;
};

export interface IIfStatementData {
    conditions: ICondition[];
};

export interface ISwitchStatementData {
    expression: string;
};

export interface ISwitchCaseData {
    value: string;
    defaultCase?: boolean;
};

export interface INodeData {
    modifier?: IModifierData;
    arguments?: IArgumentsData;
    context?: IContextData;
    forEach?: IForEachData;
    entrypoint?: IEntrypointData;
    pluginNode?: IPluginNodeData;
    exposure?: IExposureData;
    export?: IExportData;
    ifStatement?: IIfStatementData;
    switchStatement?: ISwitchStatementData;
    switchCase?: ISwitchCaseData;
    connectorLayout?: INodeConnectorLayout;
    [key: string]: unknown;
};
