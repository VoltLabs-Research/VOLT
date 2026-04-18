import type { EntrypointType } from '@/core/runtime/contracts/http-runtime';

interface WorkflowNodePosition {
    x: number;
    y: number;
}

interface WorkflowValueMap {
    [key: string]: WorkflowValue;
}

type WorkflowValue =
    | WorkflowValueMap
    | WorkflowValue[]
    | boolean
    | null
    | number
    | string

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

export interface WorkflowArgumentDefinition {
    argument?: string;
    type?: string;
    label?: string;
    default?: WorkflowValue;
    value?: WorkflowValue;
    options?: WorkflowArgumentOption[];
    optionsFromArguments?: WorkflowArgumentOptionSource[];
    listArguments?: WorkflowArgumentDefinition[];
    listItemLabelArgument?: string;
    multipleSelection?: boolean;
    pluginReferenceFilter?: string[];
    showPluginConfiguration?: boolean;
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
    iterable?: string;
}

export interface WorkflowExportData {
    exporter: string;
    type: string;
    options?: WorkflowValueMap;
}

export interface WorkflowPluginReferenceSelection {
    pluginId: string;
    config?: WorkflowValueMap;
}

export interface WorkflowPluginReferenceValue {
    selections?: WorkflowPluginReferenceSelection[];
}

interface WorkflowPluginConfigById {
    [pluginId: string]: WorkflowValueMap;
}

export interface WorkflowPluginNodeData {
    executionMode?: string;
    pluginId?: string;
    argumentReference?: string;
    config?: WorkflowValueMap;
    configByPluginId?: WorkflowPluginConfigById;
    selectedTimesteps?: number[];
}

export interface WorkflowEntrypointData {
    arguments?: string;
    binaryObjectPath?: string;
    entrypointScript?: string;
    requirementsFile?: string;
    timeout?: number;
    type?: EntrypointType;
}

export interface WorkflowNodeData {
    modifier?: WorkflowValueMap;
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
    config: WorkflowValueMap;
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
