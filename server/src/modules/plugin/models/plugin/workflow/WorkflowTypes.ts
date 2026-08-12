import { WorkflowNodeType } from '@shared/contracts/types/Plugin';
import {
    ArgumentType,
    ArgumentVisibilityOperator
} from '@volt/contracts/modules/plugin/enums';

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

export { ArgumentType };

export const ArgumentVisibilityOperators = Object.values(ArgumentVisibilityOperator);

interface ArgumentOption {
    key: string;
    label: string;
}

interface ArgumentOptionSource {
    argument?: string;
    valueField?: string;
    labelField?: string;
}

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
    /**
     * How a boolean reaches the binary's command line. `presence` (the default) emits the
     * flag only when true; `explicit` always emits `--flag true` / `--flag false`, needed
     * for flags the binary enables by default.
     */
    cliValueStyle?: 'presence' | 'explicit';
}

interface ArgumentsNodeData {
    arguments: ArgumentDefinition[];
}

enum ContextSource {
    TrajectoryDumps = 'trajectory_dumps'
}

interface ContextNodeData {
    source: ContextSource;
}

interface ForEachNodeData {
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
    ownerClusterId?: string;
    type?: EntrypointNodeType;
    arguments: string;
    requirementsFile?: string;
    entrypointScript?: string;
}

export enum PluginNodeExecutionMode {
    Manual = 'manual',
    ArgumentReference = 'argumentReference'
}

enum PluginNodeOutputPathMode {
    Isolated = 'isolated',
    Parent = 'parent'
}

interface PluginNodeData {
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

interface ExposureNodeData {
    name: string;
    icon?: string;
    results: string;
    hasListing?: boolean;
    properties?: ExposureProperty[];
    id?: string;
    /**
     * Gates the exposure on one of the plugin's arguments, using the same condition shape
     * as an argument's `visibleWhen`.
     */
    exportWhen?: ArgumentVisibilityCondition;
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

enum IfStatementConditionType {
    And = 'and',
    Or = 'or'
}

enum IfStatementConditionHandler {
    IsEqualTo = 'is_equal_to',
    IsNotEqualTo = 'is_not_equal_to'
}

interface IfStatementCondition {
    type: IfStatementConditionType;
    leftExpression: string;
    handler: IfStatementConditionHandler;
    rightExpression: string;
}

interface IfStatementNodeData {
    conditions: IfStatementCondition[];
}

interface SwitchStatementNodeData {
    expression: string;
}

interface SwitchCaseNodeData {
    value: string;
    defaultCase?: boolean;
}

interface WorkflowNodeData {
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
