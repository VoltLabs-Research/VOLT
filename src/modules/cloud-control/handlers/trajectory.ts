import { createTrajectoryRasterService } from '@/modules/trajectory-native/services';
import type {
    FilterEvaluatorService,
    GlbExporterService,
    NativeAtomsPageRequest,
    NativeColorModelRequest,
    NativeFilterPreviewRequest,
    NativeParticleFilterModelRequest,
    NativePropertyStatsRequest,
    NativeTrajectoryRequest,
    NativeUniqueValuesRequest,
    RasterizerService,
    TrajectoryParserService,
    TrajectoryPluginParserService
} from '@/modules/trajectory-native/services';
import type { MinioService } from '@/modules/platform/services';
import type { RasterizeTrajectoryRequest } from '@/shared/contracts';
import type { ReverseChannelCommandHandler } from '../services';
import { 
    readNumber, 
    readOptionalNumber, 
    readOptionalPayloadRecord, 
    readOptionalString, 
    readString,
    readPluginPropertyNamesRequest,
    readPluginModifierAnalysisRequest,
    readPluginAtomIndexRequest,
    readPluginModifierValuesRequest,
    readPluginModifierStatsRequest,
    readPluginModifierUniqueValuesRequest
} from './payloadValidation';

interface TrajectoryHandlersDependencies {
    minioService: MinioService;
    rasterizerService: RasterizerService;
    trajectoryParserService: TrajectoryParserService;
    trajectoryPluginParserService: TrajectoryPluginParserService;
    glbExporterService: GlbExporterService;
    filterEvaluatorService: FilterEvaluatorService;
};

interface NativeParticleFilterAction {
    action: 'delete' | 'highlight';
};

const readNativeTrajectoryRequest = (payload: unknown): NativeTrajectoryRequest => {
    const record = readOptionalPayloadRecord(payload);
    const request: NativeTrajectoryRequest = {
        trajectoryId: readString(record.trajectoryId, 'trajectoryId'),
        timestep: readNumber(record.timestep, 'timestep')
    };

    if (typeof record.objectKey !== 'undefined') {
        request.objectKey = readString(record.objectKey, 'objectKey');
    }

    return request;
};

const readNativePropertyStatsRequest = (payload: unknown): NativePropertyStatsRequest => {
    const request = readNativeTrajectoryRequest(payload);
    const record = readOptionalPayloadRecord(payload);

    return {
        ...request,
        property: readString(record.property, 'property')
    };
};

const readNativeUniqueValuesRequest = (payload: unknown): NativeUniqueValuesRequest => {
    const request = readNativePropertyStatsRequest(payload);
    const record = readOptionalPayloadRecord(payload);
    const maxValues = readOptionalNumber(record.maxValues);

    if (typeof maxValues === 'undefined') {
        return request;
    }

    return {
        ...request,
        maxValues
    };
};

const readNativeAtomsPageRequest = (payload: unknown): NativeAtomsPageRequest => {
    const request = readNativeTrajectoryRequest(payload);
    const record = readOptionalPayloadRecord(payload);

    return {
        ...request,
        page: readNumber(record.page, 'page'),
        limit: readNumber(record.limit, 'limit')
    };
};

const readNativeColorModelRequest = (payload: unknown): NativeColorModelRequest => {
    const request = readNativePropertyStatsRequest(payload);
    const record = readOptionalPayloadRecord(payload);
    const colorRequest: NativeColorModelRequest = {
        ...request,
        objectKey: readString(record.objectKey, 'objectKey'),
        startValue: readNumber(record.startValue, 'startValue'),
        endValue: readNumber(record.endValue, 'endValue'),
        gradient: readString(record.gradient, 'gradient')
    };
    const externalValuesBase64 = readOptionalString(record.externalValuesBase64);

    if (externalValuesBase64) {
        colorRequest.externalValuesBase64 = externalValuesBase64;
    }

    return colorRequest;
};

const readNativeFilterPreviewRequest = (payload: unknown): NativeFilterPreviewRequest => {
    const request = readNativeTrajectoryRequest(payload);
    const record = readOptionalPayloadRecord(payload);
    const previewRequest: NativeFilterPreviewRequest = {
        ...request,
        property: readString(record.property, 'property'),
        operator: readString(record.operator, 'operator'),
        value: readNumber(record.value, 'value')
    };
    const externalValuesBase64 = readOptionalString(record.externalValuesBase64);

    if (externalValuesBase64) {
        previewRequest.externalValuesBase64 = externalValuesBase64;
    }

    return previewRequest;
};

const readParticleFilterAction = (value: unknown): NativeParticleFilterAction['action'] => {
    const action = readString(value, 'action');
    if (action !== 'delete' && action !== 'highlight') {
        throw new Error('action is invalid');
    }

    return action;
};

const readNativeParticleFilterModelRequest = (payload: unknown): NativeParticleFilterModelRequest => {
    const request = readNativeTrajectoryRequest(payload);
    const record = readOptionalPayloadRecord(payload);

    return {
        ...request,
        objectKey: readString(record.objectKey, 'objectKey'),
        action: readParticleFilterAction(record.action),
        maskBase64: readString(record.maskBase64, 'maskBase64')
    };
};

const readRasterizeTrajectoryRequest = (payload: unknown): RasterizeTrajectoryRequest => {
    const record = readOptionalPayloadRecord(payload);

    return {
        trajectoryId: readString(record.trajectoryId, 'trajectoryId')
    };
};

export const createTrajectoryHandlers = (deps: TrajectoryHandlersDependencies): ReverseChannelCommandHandler[] => {
    const trajectoryRasterService = createTrajectoryRasterService(deps.minioService, deps.rasterizerService);

    return [
        {
            command: 'trajectory.rasterize',
            execute: async (payload) => ({
                data: await trajectoryRasterService.rasterizeTrajectory(readRasterizeTrajectoryRequest(payload))
            })
        },
        {
            command: 'trajectory.native.preprocess',
            execute: async (payload) => {
                await deps.glbExporterService.preprocessTrajectory(readNativeTrajectoryRequest(payload));
                return { data: { processed: true } };
            }
        },
        {
            command: 'trajectory.native.metadata',
            execute: async (payload) => ({
                data: await deps.trajectoryParserService.getTrajectoryMetadata(readNativeTrajectoryRequest(payload))
            })
        },
        {
            command: 'trajectory.native.property-stats',
            execute: async (payload) => ({
                data: await deps.trajectoryParserService.getPropertyStats(readNativePropertyStatsRequest(payload))
            })
        },
        {
            command: 'trajectory.native.unique-values',
            execute: async (payload) => ({
                data: await deps.trajectoryParserService.getUniqueValues(readNativeUniqueValuesRequest(payload))
            })
        },
        {
            command: 'trajectory.native.atoms',
            execute: async (payload) => ({
                data: await deps.trajectoryParserService.getAtomsPage(readNativeAtomsPageRequest(payload))
            })
        },
        {
            command: 'trajectory.native.filter-preview',
            execute: async (payload) => ({
                data: await deps.filterEvaluatorService.previewFilter(readNativeFilterPreviewRequest(payload))
            })
        },
        {
            command: 'trajectory.native.color-model',
            execute: async (payload) => ({
                data: await deps.filterEvaluatorService.exportColoredModel(readNativeColorModelRequest(payload))
            })
        },
        {
            command: 'trajectory.native.particle-filter-model',
            execute: async (payload) => ({
                data: await deps.filterEvaluatorService.exportParticleFilterModel(readNativeParticleFilterModelRequest(payload))
            })
        },
        {
            command: 'trajectory.plugin.property-names',
            execute: async (payload) => ({
                data: await deps.trajectoryPluginParserService.discoverPerAtomPropertyNames(readPluginPropertyNamesRequest(payload))
            })
        },
        {
            command: 'trajectory.plugin.modifier-analysis',
            execute: async (payload) => ({
                data: await deps.trajectoryPluginParserService.getModifierAnalysisData(readPluginModifierAnalysisRequest(payload))
            })
        },
        {
            command: 'trajectory.plugin.atom-index',
            execute: async (payload) => ({
                data: await deps.trajectoryPluginParserService.buildPluginIndexForAtomIds(readPluginAtomIndexRequest(payload))
            })
        },
        {
            command: 'trajectory.plugin.modifier-values',
            execute: async (payload) => ({
                data: await deps.trajectoryPluginParserService.getModifierValues(readPluginModifierValuesRequest(payload))
            })
        },
        {
            command: 'trajectory.plugin.modifier-stats',
            execute: async (payload) => ({
                data: await deps.trajectoryPluginParserService.getModifierStats(readPluginModifierStatsRequest(payload))
            })
        },
        {
            command: 'trajectory.plugin.modifier-unique-values',
            execute: async (payload) => ({
                data: await deps.trajectoryPluginParserService.getModifierUniqueValues(readPluginModifierUniqueValuesRequest(payload))
            })
        }
    ];
};
