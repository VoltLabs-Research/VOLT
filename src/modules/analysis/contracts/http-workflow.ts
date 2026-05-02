import type { EntrypointType } from '@/core/runtime/contracts/http-runtime';
import type { JsonObject, JsonValue } from '@/support/types/json';
import type { WorkflowNodePosition } from '@/modules/analysis/contracts/workflow.types';

export interface WorkflowEdgeDefinition {
    source: string;
    target: string;
    sourceHandle?: string;
    targetHandle?: string;
}

export interface WorkflowArgumentOption {
    key: string;
    label: string;
}

export interface WorkflowArgumentOptionSource {
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
    pluginReferenceFilter?: string[];
    pluginReferenceFilterKeys?: string[];
    showPluginConfiguration?: boolean;
    pluginReferenceMappings?: WorkflowPluginReferenceArgumentMapping[];
    min?: number;
    max?: number;
    step?: number;
    visibleWhen?: WorkflowArgumentVisibilityCondition;
}

export interface WorkflowArgumentsData {
    arguments?: WorkflowArgumentDefinition[];
}

export interface WorkflowForEachData {
    iterableSource?: string;
}

export interface WorkflowIfCondition {
    leftExpression?: string;
    rightExpression?: string;
    handler?: string;
    type?: string;
}

export interface WorkflowIfStatementData {
    conditions?: WorkflowIfCondition[];
}

export interface WorkflowSwitchStatementData {
    expression?: string;
}

export interface WorkflowSwitchCaseData {
    value?: string;
    defaultCase?: boolean;
}

export interface WorkflowExposureData {
    name?: string;
    results?: string;
}

export interface WorkflowExportData {
    exporter: string;
    type: string;
    options?: JsonObject;
}

export interface WorkflowPluginReferenceSelection {
    pluginId: string;
    config?: JsonObject;
}

export interface WorkflowPluginReferenceValue {
    selections?: WorkflowPluginReferenceSelection[];
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

export interface WorkflowEntrypointData {
    arguments?: string;
    binaryObjectPath?: string;
    entrypointScript?: string;
    requirementsFile?: string;
    type?: EntrypointType;
}

export interface WorkflowNodeData {
    modifier?: JsonObject;
    arguments?: WorkflowArgumentsData;
    forEach?: WorkflowForEachData;
    entrypoint?: WorkflowEntrypointData;
    pluginNode?: WorkflowPluginNodeData;
    exposure?: WorkflowExposureData;
    export?: WorkflowExportData;
    ifStatement?: WorkflowIfStatementData;
    switchStatement?: WorkflowSwitchStatementData;
    switchCase?: WorkflowSwitchCaseData;
}

export type WorkflowNodeDefinitionType =
    | 'modifier'
    | 'arguments'
    | 'context'
    | 'forEach'
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
