import type { EntrypointType } from '@shared/contracts/types/http-runtime';
import type { JsonObject, JsonValue } from '@shared/contracts/types/json';
import type { WorkflowNodePosition } from '@shared/contracts/types/workflow.types';

export interface WorkflowEdgeDefinition {
    source: string;
    target: string;
    sourceHandle?: string;
    targetHandle?: string;
}

interface WorkflowArgumentOption {
    key: string;
    label: string;
}

interface WorkflowArgumentOptionSource {
    argument?: string;
    valueField?: string;
    labelField?: string;
}

export interface WorkflowArgumentVisibilityCondition {
    argument?: string;
    operator?: 'equals' | 'notEquals' | 'in' | 'notIn';
    value?: string | number | boolean;
    values?: Array<string | number | boolean>;
}

export interface WorkflowPluginReferenceArgumentMapping {
    sourceArgument?: string;
    targetArgument?: string;
    targetPluginId?: string;
    targetPluginKey?: string;
    valueMap?: Record<string, JsonValue>;
}

export interface WorkflowArgumentDefinition {
    argument?: string;
    type?: string;
    label?: string;
    default?: JsonValue;
    value?: JsonValue;
    options?: WorkflowArgumentOption[];
    optionsFromArguments?: WorkflowArgumentOptionSource[];
    listArguments?: WorkflowArgumentDefinition[];
    listItemLabelArgument?: string;
    required?: boolean;
    multipleSelection?: boolean;
    inferFromContext?: boolean;
    pluginReferenceFilter?: string[];
    pluginReferenceFilterKeys?: string[];
    showPluginConfiguration?: boolean;
    pluginReferenceMappings?: WorkflowPluginReferenceArgumentMapping[];
    min?: number;
    max?: number;
    step?: number;
    visibleWhen?: WorkflowArgumentVisibilityCondition;
    /**
     * How a boolean reaches the binary's command line.
     *
     * `presence` (the default) emits the flag only when true and nothing when false, which
     * is all a binary needs when its own default for that flag is false.
     *
     * `explicit` emits `--flag true` / `--flag false` on every run. Required for flags whose
     * binary-side default is true: omitting them cannot express false, so the option could
     * never be turned off.
     */
    cliValueStyle?: 'presence' | 'explicit';
}

interface WorkflowArgumentsData {
    arguments?: WorkflowArgumentDefinition[];
}

interface WorkflowForEachData {
    iterableSource?: string;
}

type WorkflowTrajectoryWindowMode = 'window' | 'all' | 'referencePair';

export interface WorkflowTrajectoryWindowData {
    mode: WorkflowTrajectoryWindowMode;
    windowSize?: number;
    centered?: boolean;
    referenceTimestep?: number;
}

export interface WorkflowIfCondition {
    leftExpression?: string;
    rightExpression?: string;
    handler?: string;
    type?: string;
}

interface WorkflowIfStatementData {
    conditions?: WorkflowIfCondition[];
}

export interface WorkflowSwitchStatementData {
    expression?: string;
}

export interface WorkflowSwitchCaseData {
    value?: string;
    defaultCase?: boolean;
}

interface WorkflowExposureData {
    name?: string;
    results?: string;
    id?: string;
    /**
     * Gates the exposure on one of the plugin's arguments. When it evaluates false the
     * exposure never enters the run's exposure list, so nothing registers, exports or
     * persists it.
     */
    exportWhen?: WorkflowArgumentVisibilityCondition;
}

interface WorkflowExportData {
    exporter: string;
    type: string;
    options?: JsonObject;
}

export interface WorkflowPluginReferenceSelection {
    pluginId: string;
    config?: JsonObject;
}

interface WorkflowPluginConfigById {
    [pluginId: string]: JsonObject;
}

export interface WorkflowPluginNodeData {
    executionMode?: string;
    outputPathMode?: 'isolated' | 'parent';
    pluginId?: string;
    argumentReference?: string;
    config?: JsonObject;
    configByPluginId?: WorkflowPluginConfigById;
    selectedTimesteps?: number[];
}

interface WorkflowEntrypointData {
    arguments?: string;
    binaryObjectPath?: string;
    ownerClusterId?: string;
    entrypointScript?: string;
    requirementsFile?: string;
    type?: EntrypointType;
}

export interface WorkflowNodeData {
    modifier?: JsonObject;
    arguments?: WorkflowArgumentsData;
    forEach?: WorkflowForEachData;
    trajectoryWindow?: WorkflowTrajectoryWindowData;
    entrypoint?: WorkflowEntrypointData;
    pluginNode?: WorkflowPluginNodeData;
    exposure?: WorkflowExposureData;
    export?: WorkflowExportData;
    ifStatement?: WorkflowIfStatementData;
    switchStatement?: WorkflowSwitchStatementData;
    switchCase?: WorkflowSwitchCaseData;
}

type WorkflowNodeDefinitionType =
    | 'modifier'
    | 'arguments'
    | 'context'
    | 'forEach'
    | 'trajectory-window'
    | 'entrypoint'
    | 'plugin-node'
    | 'exposure'
    | 'export'
    | 'if-statement'
    | 'switch-statement'
    | 'switch-case';

export interface WorkflowNodeDefinition {
    id: string;
    type: WorkflowNodeDefinitionType;
    position: WorkflowNodePosition;
    data: WorkflowNodeData;
}

export interface WorkflowDefinition {
    nodes: WorkflowNodeDefinition[];
    edges: WorkflowEdgeDefinition[];
}

export interface NestedPluginDefinition {
    pluginId: string;
    workflow: WorkflowDefinition;
}

export interface PluginReferenceExecutionRequest {
    referencePath: string;
    pluginId: string;
    config: JsonObject;
}

export interface TrajectoryFrame {
    timestep: number;
    natoms: number;
    simulationCell: string;
}

export interface TrajectoryDumpDescriptor extends TrajectoryFrame {
    path: string;
    originalPath?: string;
}
