import { WorkflowNodeType } from '@shared/contracts/types/Plugin';

export { WorkflowNodeType };

export interface ModifierNodeData {
    key?: string;
    name: string;
    author?: string;
    license?: string;
    version?: string;
    homepage?: string;
    description?: string;
}

export enum ArgumentType {
    Select = 'select',
    Number = 'number',
    Frame = 'frame',
    Boolean = 'boolean',
    String = 'string',
    List = 'list',
    Tuple = 'tuple',
    PluginReference = 'pluginReference'
}

export interface ArgumentOption {
    key: string;
    label: string;
}

export interface ArgumentOptionSource {
    argument?: string;
    valueField?: string;
    labelField?: string;
}

export const ArgumentVisibilityOperators = [
    'equals',
    'notEquals',
    'in',
    'notIn'
] as const;

export type ArgumentVisibilityOperator = (typeof ArgumentVisibilityOperators)[number];

export interface ArgumentVisibilityCondition {
    argument: string;
    operator: ArgumentVisibilityOperator;
    value?: string | number | boolean;
    values?: Array<string | number | boolean>;
}

export interface PluginReferenceArgumentMapping {
    sourceArgument: string;
    targetArgument: string;
    targetPluginId?: string;
    targetPluginKey?: string;
    valueMap?: Record<string, unknown>;
}

export interface ArgumentDefinition {
    argument: string;
    type: ArgumentType;
    label: string;
    default?: unknown;
    value?: unknown;
    options?: ArgumentOption[];
    optionsFromArguments?: ArgumentOptionSource[];
    optionsFromPluginReference?: string;
    listArguments?: ArgumentDefinition[];
    listItemLabelArgument?: string;
    required?: boolean;
    multipleSelection?: boolean;
    inferFromContext?: boolean;

    plugins?: string[];
    pluginReferenceFilter?: string[];
    pluginReferenceFilterKeys?: string[];
    showPluginConfiguration?: boolean;
    pluginReferenceMappings?: PluginReferenceArgumentMapping[];
    min?: number;
    max?: number;
    step?: number;
    visibleWhen?: ArgumentVisibilityCondition;
}

export interface ArgumentsNodeData {
    arguments: ArgumentDefinition[];
}

export enum ContextSource {
    TrajectoryDumps = 'trajectory_dumps'
}

export interface ContextNodeData {
    source: ContextSource;
}

export interface ForEachNodeData {
    iterableSource: string;
}

export enum EntrypointNodeType {
    Executable = 'executable',
    PythonScript = 'python-script',
    PackagedExecutable = 'packaged-executable'
}

export interface EntrypointNodeData {
    binary?: string;
    binaryObjectPath?: string;
    binaryFileName?: string;
    binaryHash?: string;
    type?: EntrypointNodeType;
    arguments: string;
    requirementsFile?: string;
    entrypointScript?: string;
}

export enum PluginNodeExecutionMode {
    Manual = 'manual',
    ArgumentReference = 'argumentReference'
}

export enum PluginNodeOutputPathMode {
    Isolated = 'isolated',
    Parent = 'parent'
}

export interface PluginNodeData {
    executionMode?: PluginNodeExecutionMode;
    outputPathMode?: PluginNodeOutputPathMode;
    pluginId?: string;
    argumentReference?: string;
    selectedTeamClusterId?: string;
    selectedTimesteps?: number[];
    config?: Record<string, unknown>;
    configByPluginId?: Record<string, Record<string, unknown>>;
}

export interface ExposureProperty {
    key: string;
    label?: string;
    type?: string;
}

export interface ExposureNodeData {
    name: string;
    icon?: string;
    results: string;
    hasListing?: boolean;
    properties?: ExposureProperty[];
    id?: string;
}

export enum Exporter {
    Atomistic = 'AtomisticExporter',
    Mesh = 'MeshExporter',
    Line = 'LineExporter',
    Chart = 'ChartExporter',
    Bond = 'BondExporter',
    Configuration = 'ConfigurationExporter'
}

export enum ExportType {
    GLB = 'glb',
    ChartPNG = 'chart-png',
    LammpsDump = 'lammps-dump',
    LammpsData = 'lammps-data',
    ExtXYZ = 'extxyz',
    POSCAR = 'poscar',
    CIF = 'cif'
}

export interface ExportNodeData {
    exporter: Exporter;
    type: ExportType;
    options?: Record<string, unknown>;
}

export enum IfStatementConditionType {
    And = 'and',
    Or = 'or'
}

export enum IfStatementConditionHandler {
    IsEqualTo = 'is_equal_to',
    IsNotEqualTo = 'is_not_equal_to'
}

export interface IfStatementCondition {
    type: IfStatementConditionType;
    leftExpression: string;
    handler: IfStatementConditionHandler;
    rightExpression: string;
}

export interface IfStatementNodeData {
    conditions: IfStatementCondition[];
}

export interface SwitchStatementNodeData {
    expression: string;
}

export interface SwitchCaseNodeData {
    value: string;
    defaultCase?: boolean;
}

export interface WorkflowNodeData {
    modifier?: ModifierNodeData;
    arguments?: ArgumentsNodeData;
    context?: ContextNodeData;
    forEach?: ForEachNodeData;
    entrypoint?: EntrypointNodeData;
    pluginNode?: PluginNodeData;
    exposure?: ExposureNodeData;
    export?: ExportNodeData;
    ifStatement?: IfStatementNodeData;
    switchStatement?: SwitchStatementNodeData;
    switchCase?: SwitchCaseNodeData;
}

export interface WorkflowNode {
    id: string;
    type: WorkflowNodeType;
    position: {
        x: number;
        y: number;
    };
    data: WorkflowNodeData;
}

export interface WorkflowEdge {
    id: string;
    source: string;
    sourceHandle?: string;
    target: string;
    targetHandle?: string;
}
