import { ContainerAction, ObjectBucketName, RemoteExplorerTarget, TextEncoding } from '@/shared/contracts';
import type { WorkflowDefinition, WorkflowEdgeDefinition, WorkflowNodeDefinition } from '@/shared/contracts';
import type { RemoteExplorerRequest } from '@/shared/contracts';
import { isRecord } from '@/shared/utils';

interface StringEnumLike {
    [key: string]: string;
};

type EnumValue<TEnum extends StringEnumLike> = TEnum[keyof TEnum];

interface TrajectoryFramePayload {
    timestep: number;
    natoms: number;
    simulationCell: string;
};

interface RemoteExplorerPayloadRequest {
    target: RemoteExplorerRequest['target'];
    path: RemoteExplorerRequest['path'];
};

export const readString = (value: unknown, fieldName: string): string => {
    if (typeof value !== 'string' || value.trim().length === 0) {
        throw new Error(`${fieldName} is required`);
    }

    return value;
};

export const readOptionalString = (value: unknown, fallback = ''): string => {
    if (typeof value !== 'string') {
        return fallback;
    }

    return value;
};

export const readBoolean = (value: unknown, fieldName: string): boolean => {
    if (typeof value !== 'boolean') {
        throw new Error(`${fieldName} must be a boolean`);
    }

    return value;
};

export const readOptionalBoolean = (value: unknown, fallback: boolean): boolean => {
    if (typeof value !== 'boolean') {
        return fallback;
    }

    return value;
};

export const readNumber = (value: unknown, fieldName: string): number => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new Error(`${fieldName} must be a number`);
    }

    return value;
};

export const readOptionalNumber = (value: unknown): number | undefined => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return undefined;
    }

    return value;
};

export const readRecord = (value: unknown, fieldName: string): Record<string, unknown> => {
    if (!isRecord(value)) {
        throw new Error(`${fieldName} must be an object`);
    }

    const record: Record<string, unknown> = {};
    for (const [key, entryValue] of Object.entries(value)) {
        record[key] = entryValue;
    }

    return record;
};

export const readOptionalRecord = (value: unknown): Record<string, unknown> | undefined => {
    if (!isRecord(value)) {
        return undefined;
    }

    const record: Record<string, unknown> = {};
    for (const [key, entryValue] of Object.entries(value)) {
        record[key] = entryValue;
    }

    return record;
};

export const readPayloadRecord = (value: unknown): Record<string, unknown> => {
    return readRecord(value, 'payload');
};

export const readOptionalPayloadRecord = (value: unknown): Record<string, unknown> => {
    const record = readOptionalRecord(value);

    if (!record) {
        return {};
    }

    return record;
};

export const readStringArray = (value: unknown, fieldName: string): string[] => {
    if (!Array.isArray(value)) {
        throw new Error(`${fieldName} must be an array`);
    }

    const values: string[] = [];
    for (const entry of value) {
        values.push(readString(entry, fieldName));
    }

    return values;
};

export const readOptionalStringArray = (value: unknown, fieldName: string): string[] | undefined => {
    if (typeof value === 'undefined') {
        return undefined;
    }

    return readStringArray(value, fieldName);
};

export const readOptionalNumberArray = (value: unknown, fieldName: string): number[] | undefined => {
    if (typeof value === 'undefined') {
        return undefined;
    }

    if (!Array.isArray(value)) {
        throw new Error(`${fieldName} must be an array`);
    }

    return value.map((entry) => readNumber(entry, fieldName));
};

export const readOptionalStringRecord = (value: unknown, fieldName: string): Record<string, string> | undefined => {
    if (typeof value === 'undefined') {
        return undefined;
    }

    const record = readRecord(value, fieldName);
    const result: Record<string, string> = {};

    for (const [key, entryValue] of Object.entries(record)) {
        result[key] = readString(entryValue, `${fieldName}.${key}`);
    }

    return result;
};

export const readOptionalUnknownRecord = (value: unknown, fieldName: string): Record<string, unknown> | undefined => {
    if (typeof value === 'undefined') {
        return undefined;
    }

    return readRecord(value, fieldName);
};

export const readWorkflowNodeDefinition = (value: unknown): WorkflowNodeDefinition => {
    const record = readRecord(value, 'workflow.nodes');
    const position = readRecord(record.position, 'workflow.nodes.position');

    return {
        id: readString(record.id, 'workflow.nodes.id'),
        type: readString(record.type, 'workflow.nodes.type'),
        position: {
            x: readNumber(position.x, 'workflow.nodes.position.x'),
            y: readNumber(position.y, 'workflow.nodes.position.y')
        },
        data: readRecord(record.data, 'workflow.nodes.data')
    };
};

export const readWorkflowEdgeDefinition = (value: unknown): WorkflowEdgeDefinition => {
    const record = readRecord(value, 'workflow.edges');
    const edge: WorkflowEdgeDefinition = {
        source: readString(record.source, 'workflow.edges.source'),
        target: readString(record.target, 'workflow.edges.target')
    };

    if (typeof record.sourceHandle !== 'undefined') {
        edge.sourceHandle = readString(record.sourceHandle, 'workflow.edges.sourceHandle');
    }

    if (typeof record.targetHandle !== 'undefined') {
        edge.targetHandle = readString(record.targetHandle, 'workflow.edges.targetHandle');
    }

    return edge;
};

export const readWorkflowDefinition = (value: unknown): WorkflowDefinition => {
    const record = readRecord(value, 'workflow');
    const nodesValue = record.nodes;
    const edgesValue = record.edges;

    if (!Array.isArray(nodesValue)) {
        throw new Error('workflow.nodes must be an array');
    }

    if (!Array.isArray(edgesValue)) {
        throw new Error('workflow.edges must be an array');
    }

    return {
        nodes: nodesValue.map(readWorkflowNodeDefinition),
        edges: edgesValue.map(readWorkflowEdgeDefinition)
    };
};

export const readTrajectoryFrames = (value: unknown): TrajectoryFramePayload[] => {
    if (!Array.isArray(value)) {
        throw new Error('trajectoryFrames must be an array');
    }

    return value.map((entry) => {
        const record = readRecord(entry, 'trajectoryFrames');

        return {
            timestep: readNumber(record.timestep, 'trajectoryFrames.timestep'),
            natoms: readNumber(record.natoms, 'trajectoryFrames.natoms'),
            simulationCell: readString(record.simulationCell, 'trajectoryFrames.simulationCell')
        };
    });
};

export const readRemoteExplorerRequest = (payload: unknown): RemoteExplorerPayloadRequest => {
    const record = readPayloadRecord(payload);
    const target = readString(record.target, 'target');

    if (!isEnumValue(RemoteExplorerTarget, target)) {
        throw new Error('target is invalid');
    }

    return {
        target,
        path: typeof record.path === 'string'
            ? record.path
            : ''
    };
};

export const readPluginPropertyNamesRequest = (payload: unknown) => {
    const record = readOptionalPayloadRecord(payload);
    const timestep = readOptionalNumber(record.timestep);
    const ownerClusterId = typeof record.ownerClusterId === 'string'
        ? readString(record.ownerClusterId, 'ownerClusterId')
        : undefined;

    return {
        trajectoryId: readString(record.trajectoryId, 'trajectoryId'),
        analysisId: readString(record.analysisId, 'analysisId'),
        exposureId: readString(record.exposureId, 'exposureId'),
        ...(typeof timestep === 'number' ? { timestep } : {}),
        ...(ownerClusterId ? { ownerClusterId } : {})
    };
};

export const readPluginModifierAnalysisRequest = (payload: unknown) => {
    const request = readPluginPropertyNamesRequest(payload);
    const record = readOptionalPayloadRecord(payload);
    return {
        ...request,
        timestep: readNumber(record.timestep, 'timestep')
    };
};

export const readPluginAtomIndexRequest = (payload: unknown) => {
    const request = readPluginModifierAnalysisRequest(payload);
    const record = readOptionalPayloadRecord(payload);
    return {
        ...request,
        targetIds: readOptionalNumberArray(record.targetIds, 'targetIds') || []
    };
};

export const readPluginModifierValuesRequest = (payload: unknown) => {
    const request = readPluginModifierAnalysisRequest(payload);
    const record = readOptionalPayloadRecord(payload);
    return {
        ...request,
        property: readString(record.property, 'property')
    };
};

export const readPluginModifierStatsRequest = (payload: unknown) => {
    return readPluginModifierValuesRequest(payload);
};

export const readPluginModifierUniqueValuesRequest = (payload: unknown) => {
    const request = readPluginModifierValuesRequest(payload);
    const record = readOptionalPayloadRecord(payload);
    return {
        ...request,
        maxValues: readOptionalNumber(record.maxValues)
    };
};

const isEnumValue = <TEnum extends StringEnumLike>(
    enumObject: TEnum,
    value: string
): value is EnumValue<TEnum> => {
    return Object.values(enumObject).some((enumValue) => enumValue === value);
};

export const readObjectBucketName = (value: unknown, fieldName: string): ObjectBucketName => {
    const bucketName = readString(value, fieldName);

    if (!isEnumValue(ObjectBucketName, bucketName)) {
        throw new Error(`${fieldName} is invalid`);
    }

    return bucketName;
};

export const readTextEncoding = (value: unknown): TextEncoding | undefined => {
    if (typeof value === 'undefined') {
        return undefined;
    }

    const encoding = readString(value, 'encoding');
    if (!isEnumValue(TextEncoding, encoding)) {
        throw new Error('encoding is invalid');
    }

    return encoding;
};

export const readPluginAnalysisAllAtomsRequest = (payload: unknown) => {
    const record = readOptionalPayloadRecord(payload);
    const ownerClusterId = typeof record.ownerClusterId === 'string'
        ? readString(record.ownerClusterId, 'ownerClusterId')
        : undefined;
    return {
        trajectoryId: readString(record.trajectoryId, 'trajectoryId'),
        analysisId: readString(record.analysisId, 'analysisId'),
        timestep: readNumber(record.timestep, 'timestep'),
        ...(ownerClusterId ? { ownerClusterId } : {})
    };
};

export const readContainerAction = (value: unknown): ContainerAction => {
    const action = readString(value, 'action');
    if (!isEnumValue(ContainerAction, action)) {
        throw new Error('action is invalid');
    }

    return action;
};
