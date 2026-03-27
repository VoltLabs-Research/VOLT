import { createTrajectoryRasterQueueService } from '@/modules/trajectory-native/services';
import { createTrajectoryGlbQueueService } from '@/modules/trajectory-native/services';
import type {
    FilterEvaluatorService,
    GlbExporterService,
    NativeColorModelRequest,
    NativeFilterPreviewRequest,
    NativeParticleFilterModelRequest,
    NativePropertyStatsRequest,
    NativeTrajectoryRequest,
    NativeUniqueValuesRequest,
    TrajectoryAutoPreviewClaimStore,
    TrajectoryParserService,
    TrajectoryPluginParserService
} from '@/modules/trajectory-native/services';
import type { QueueService, RedisConnectionService } from '@/modules/platform/services';
import type { EnqueuePreprocessingRequest, EnqueuePreprocessingFrameDescriptor, RasterizeTrajectoryRequest } from '@/shared/contracts';
import { TEAM_CLUSTER_DAEMON_COMMAND } from '@/shared/contracts';
import type { ReverseChannelCommandHandler } from '../services';
import type { RuntimeCapabilityGuard } from '../services';
import type { ClusterObjectStore } from '@/shared/storage/ClusterObjectStore';
import {
    readBoolean,
    readNumber,
    readOptionalNumber,
    readOptionalPayloadRecord,
    readOptionalString,
    readOptionalUnknownRecord,
    readRecord,
    readString,
    readPluginPropertyNamesRequest,
    readPluginModifierAnalysisRequest,
    readPluginAtomIndexRequest,
    readPluginModifierValuesRequest,
    readPluginModifierStatsRequest,
    readPluginModifierUniqueValuesRequest,
    readPluginAnalysisAllAtomsRequest
} from './payloadValidation';

interface TrajectoryHandlersDependencies {
    objectStore: ClusterObjectStore;
    queueService: QueueService;
    redisConnectionService: RedisConnectionService;
    trajectoryAutoPreviewClaimStore: TrajectoryAutoPreviewClaimStore;
    trajectoryParserService: TrajectoryParserService;
    trajectoryPluginParserService: TrajectoryPluginParserService;
    glbExporterService: GlbExporterService;
    filterEvaluatorService: FilterEvaluatorService;
    runtimeCapabilityGuard: RuntimeCapabilityGuard;
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
    const teamId = readOptionalString(record.teamId);
    const trajectoryName = readOptionalString(record.trajectoryName);
    const ownerClusterId = readOptionalString(record.ownerClusterId);

    if (typeof record.objectKey !== 'undefined') {
        request.objectKey = readString(record.objectKey, 'objectKey');
    }

    if (ownerClusterId) {
        request.ownerClusterId = ownerClusterId;
    }

    if (teamId) {
        request.teamId = teamId;
    }

    if (trajectoryName) {
        request.trajectoryName = trajectoryName;
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

const readNativeAtomsPageRequest = (payload: unknown) => {
    const request = readNativeTrajectoryRequest(payload);
    const record = readOptionalPayloadRecord(payload);
    const analysisId = readOptionalString(record.analysisId);

    return {
        ...request,
        page: readNumber(record.page, 'page'),
        limit: readNumber(record.limit, 'limit'),
        ...(analysisId ? { analysisId } : {})
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
    const analysisId = readOptionalString(record.analysisId);
    const exposureId = readOptionalString(record.exposureId);
    const externalValuesBase64 = readOptionalString(record.externalValuesBase64);

    if (analysisId) {
        colorRequest.analysisId = analysisId;
    }

    if (exposureId) {
        colorRequest.exposureId = exposureId;
    }

    if (externalValuesBase64) {
        colorRequest.externalValuesBase64 = externalValuesBase64;
    }

    return colorRequest;
};

const readNumberVector = (value: unknown, fieldName: string, length: number): number[] => {
    if (!Array.isArray(value) || value.length !== length) {
        throw new Error(`${fieldName} must be an array with ${length} item(s)`);
    }

    return value.map((entry, index) => readNumber(entry, `${fieldName}[${index}]`));
};

const readNativeSurfaceAtomsPresetConfig = (
    value: unknown
): Extract<NativeFilterPreviewRequest, { kind: 'preset' }>['presetConfig'] => {
    const record = readRecord(value, 'presetConfig');
    const cutoffMode = readString(record.cutoffMode, 'presetConfig.cutoffMode');
    if (cutoffMode !== 'auto' && cutoffMode !== 'manual') {
        throw new Error('presetConfig.cutoffMode is invalid');
    }

    const cutoffRadius = readOptionalNumber(record.cutoffRadius);

    if (cutoffMode === 'manual' && cutoffRadius === undefined) {
        throw new Error('presetConfig.cutoffRadius is required when cutoffMode is manual');
    }

    return {
        layers: readNumber(record.layers, 'presetConfig.layers'),
        cutoffMode,
        ...(cutoffRadius === undefined ? {} : { cutoffRadius }),
        coordinationDeficit: readNumber(record.coordinationDeficit, 'presetConfig.coordinationDeficit'),
        anisotropyThreshold: readNumber(record.anisotropyThreshold, 'presetConfig.anisotropyThreshold'),
        byType: readBoolean(record.byType, 'presetConfig.byType')
    };
};

const readNativeSimulationCell = (
    value: unknown
): Extract<NativeFilterPreviewRequest, { kind: 'preset' }>['simulationCell'] => {
    const record = readRecord(value, 'simulationCell');
    const boundingBox = readRecord(record.boundingBox, 'simulationCell.boundingBox');
    const geometry = readRecord(record.geometry, 'simulationCell.geometry');
    const cellVectors = geometry.cell_vectors;
    const periodicBoundaryConditions = readRecord(
        geometry.periodic_boundary_conditions,
        'simulationCell.geometry.periodic_boundary_conditions'
    );

    if (!Array.isArray(cellVectors) || cellVectors.length !== 3) {
        throw new Error('simulationCell.geometry.cell_vectors must be an array with 3 item(s)');
    }

    return {
        boundingBox: {
            width: readNumber(boundingBox.width, 'simulationCell.boundingBox.width'),
            height: readNumber(boundingBox.height, 'simulationCell.boundingBox.height'),
            length: readNumber(boundingBox.length, 'simulationCell.boundingBox.length')
        },
        geometry: {
            cell_vectors: [
                readNumberVector(cellVectors[0], 'simulationCell.geometry.cell_vectors[0]', 3),
                readNumberVector(cellVectors[1], 'simulationCell.geometry.cell_vectors[1]', 3),
                readNumberVector(cellVectors[2], 'simulationCell.geometry.cell_vectors[2]', 3)
            ],
            cell_origin: readNumberVector(geometry.cell_origin, 'simulationCell.geometry.cell_origin', 3),
            periodic_boundary_conditions: {
                x: readBoolean(periodicBoundaryConditions.x, 'simulationCell.geometry.periodic_boundary_conditions.x'),
                y: readBoolean(periodicBoundaryConditions.y, 'simulationCell.geometry.periodic_boundary_conditions.y'),
                z: readBoolean(periodicBoundaryConditions.z, 'simulationCell.geometry.periodic_boundary_conditions.z')
            }
        }
    };
};

const readNativeFilterPreviewRequest = (payload: unknown): NativeFilterPreviewRequest => {
    const request = readNativeTrajectoryRequest(payload);
    const record = readOptionalPayloadRecord(payload);
    const kind = readOptionalString(record.kind);
    const mode = readOptionalString(record.mode);
    const resolvedKind = kind || (mode === 'preset' ? 'preset' : 'property');

    if (resolvedKind === 'preset') {
        const preset = readString(record.preset, 'preset');
        if (preset !== 'surface-atoms') {
            throw new Error('preset is invalid');
        }

        return {
            ...request,
            kind: 'preset',
            preset: 'surface-atoms',
            presetConfig: readNativeSurfaceAtomsPresetConfig(record.presetConfig),
            simulationCell: readNativeSimulationCell(record.simulationCell)
        };
    }

    const previewRequest: Extract<NativeFilterPreviewRequest, { kind: 'property' }> = {
        ...request,
        kind: 'property',
        property: readString(record.property, 'property'),
        operator: readString(record.operator, 'operator'),
        value: readNumber(record.value, 'value')
    };
    const analysisId = readOptionalString(record.analysisId);
    const exposureId = readOptionalString(record.exposureId);
    const externalValuesBase64 = readOptionalString(record.externalValuesBase64);

    if (analysisId) {
        previewRequest.analysisId = analysisId;
    }

    if (exposureId) {
        previewRequest.exposureId = exposureId;
    }

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
    const config = readOptionalUnknownRecord(record.config, 'config');
    const storageClusterId = readOptionalString(record.storageClusterId);

    return {
        trajectoryId: readString(record.trajectoryId, 'trajectoryId'),
        teamId: readString(record.teamId, 'teamId'),
        trajectoryName: readOptionalString(record.trajectoryName),
        ...(storageClusterId ? { storageClusterId } : {}),
        ...(config ? { config } : {})
    };
};

const readEnqueuePreprocessingFrameDescriptor = (value: unknown, index: number): EnqueuePreprocessingFrameDescriptor => {
    const record = readOptionalPayloadRecord(value);
    const ownerClusterId = readOptionalString(record.ownerClusterId);

    return {
        timestep: readNumber(record.timestep, `frames[${index}].timestep`),
        objectKey: readString(record.objectKey, `frames[${index}].objectKey`),
        ...(ownerClusterId ? { ownerClusterId } : {})
    };
};

const readEnqueuePreprocessingRequest = (payload: unknown): EnqueuePreprocessingRequest => {
    const record = readOptionalPayloadRecord(payload);
    const storageClusterId = readOptionalString(record.storageClusterId);

    if (!Array.isArray(record.frames) || record.frames.length === 0) {
        throw new Error('frames must be a non-empty array');
    }

    return {
        trajectoryId: readString(record.trajectoryId, 'trajectoryId'),
        teamId: readString(record.teamId, 'teamId'),
        trajectoryName: readOptionalString(record.trajectoryName),
        ...(storageClusterId ? { storageClusterId } : {}),
        frames: record.frames.map((frame: unknown, index: number) =>
            readEnqueuePreprocessingFrameDescriptor(frame, index)
        )
    };
};

export const createTrajectoryHandlers = (deps: TrajectoryHandlersDependencies): ReverseChannelCommandHandler[] => {
    const trajectoryRasterQueueService = createTrajectoryRasterQueueService(
        deps.objectStore,
        deps.queueService,
        deps.trajectoryAutoPreviewClaimStore
    );
    const trajectoryGlbQueueService = createTrajectoryGlbQueueService(
        deps.objectStore,
        deps.queueService
    );

    return [
        {
            command: TEAM_CLUSTER_DAEMON_COMMAND.trajectory.rasterize,
            execute: async (payload) => {
                deps.runtimeCapabilityGuard.ensureAcceptsComputeJobs(
                    TEAM_CLUSTER_DAEMON_COMMAND.trajectory.rasterize
                );
                return {
                    data: await trajectoryRasterQueueService.queueRasterizationJobs(
                        readRasterizeTrajectoryRequest(payload)
                    )
                };
            }
        },
        {
            command: TEAM_CLUSTER_DAEMON_COMMAND.trajectory.enqueuePreprocessing,
            execute: async (payload) => {
                deps.runtimeCapabilityGuard.ensureAcceptsComputeJobs(
                    TEAM_CLUSTER_DAEMON_COMMAND.trajectory.enqueuePreprocessing
                );
                return {
                    data: await trajectoryGlbQueueService.enqueueGlbConversionJobs(
                        readEnqueuePreprocessingRequest(payload)
                    )
                };
            }
        },
        {
            command: TEAM_CLUSTER_DAEMON_COMMAND.trajectory.native.preprocess,
            execute: async (payload) => {
                deps.runtimeCapabilityGuard.ensureTrajectoryNativeEnabled(
                    TEAM_CLUSTER_DAEMON_COMMAND.trajectory.native.preprocess
                );
                await deps.glbExporterService.preprocessTrajectory(readNativeTrajectoryRequest(payload));
                return { data: { glbExported: true } };
            }
        },
        {
            command: TEAM_CLUSTER_DAEMON_COMMAND.trajectory.native.metadata,
            execute: async (payload) => {
                deps.runtimeCapabilityGuard.ensureTrajectoryNativeEnabled(
                    TEAM_CLUSTER_DAEMON_COMMAND.trajectory.native.metadata
                );
                return {
                    data: await deps.trajectoryParserService.getTrajectoryMetadata(readNativeTrajectoryRequest(payload))
                };
            }
        },
        {
            command: TEAM_CLUSTER_DAEMON_COMMAND.trajectory.native.propertyStats,
            execute: async (payload) => {
                deps.runtimeCapabilityGuard.ensureTrajectoryNativeEnabled(
                    TEAM_CLUSTER_DAEMON_COMMAND.trajectory.native.propertyStats
                );
                return {
                    data: await deps.trajectoryParserService.getPropertyStats(readNativePropertyStatsRequest(payload))
                };
            }
        },
        {
            command: TEAM_CLUSTER_DAEMON_COMMAND.trajectory.native.uniqueValues,
            execute: async (payload) => {
                deps.runtimeCapabilityGuard.ensureTrajectoryNativeEnabled(
                    TEAM_CLUSTER_DAEMON_COMMAND.trajectory.native.uniqueValues
                );
                return {
                    data: await deps.trajectoryParserService.getUniqueValues(readNativeUniqueValuesRequest(payload))
                };
            }
        },
        {
            command: TEAM_CLUSTER_DAEMON_COMMAND.trajectory.native.atomIds,
            execute: async (payload) => {
                deps.runtimeCapabilityGuard.ensureTrajectoryNativeEnabled(
                    TEAM_CLUSTER_DAEMON_COMMAND.trajectory.native.atomIds
                );
                return {
                    data: await deps.trajectoryParserService.getAtomIds(readNativeTrajectoryRequest(payload))
                };
            }
        },
        {
            command: TEAM_CLUSTER_DAEMON_COMMAND.trajectory.native.atoms,
            execute: async (payload) => {
                deps.runtimeCapabilityGuard.ensureTrajectoryNativeEnabled(
                    TEAM_CLUSTER_DAEMON_COMMAND.trajectory.native.atoms
                );
                const request = readNativeAtomsPageRequest(payload);
                const nativeResult = await deps.trajectoryParserService.getAtomsPage(request);

                if (!request.analysisId) {
                    return { data: nativeResult };
                }

                const pageAtomIds = new Set<number>(
                    nativeResult.atoms.map((a: Record<string, unknown>) => Number(a.id))
                );
                const ownerClusterId = request.ownerClusterId;
                if (!ownerClusterId) {
                    throw new Error(
                        `ownerClusterId is required to load per-atom analysis data for trajectory ${request.trajectoryId}`
                    );
                }

                const analysisResult = await deps.trajectoryPluginParserService.getAnalysisAllPerAtomData({
                    trajectoryId: request.trajectoryId,
                    analysisId: request.analysisId,
                    timestep: request.timestep,
                    atomIds: pageAtomIds,
                    ownerClusterId
                });

                return {
                    data: {
                        ...nativeResult,
                        analysisPropertyNames: analysisResult.propertyNames,
                        analysisAtoms: analysisResult.atoms
                    }
                };
            }
        },
        {
            command: TEAM_CLUSTER_DAEMON_COMMAND.trajectory.native.filterPreview,
            execute: async (payload) => {
                deps.runtimeCapabilityGuard.ensureTrajectoryNativeEnabled(
                    TEAM_CLUSTER_DAEMON_COMMAND.trajectory.native.filterPreview
                );
                return {
                    data: await deps.filterEvaluatorService.previewFilter(readNativeFilterPreviewRequest(payload))
                };
            }
        },
        {
            command: TEAM_CLUSTER_DAEMON_COMMAND.trajectory.native.colorModel,
            execute: async (payload) => {
                deps.runtimeCapabilityGuard.ensureTrajectoryNativeEnabled(
                    TEAM_CLUSTER_DAEMON_COMMAND.trajectory.native.colorModel
                );
                return {
                    data: await deps.filterEvaluatorService.exportColoredModel(readNativeColorModelRequest(payload))
                };
            }
        },
        {
            command: TEAM_CLUSTER_DAEMON_COMMAND.trajectory.native.particleFilterModel,
            execute: async (payload) => {
                deps.runtimeCapabilityGuard.ensureTrajectoryNativeEnabled(
                    TEAM_CLUSTER_DAEMON_COMMAND.trajectory.native.particleFilterModel
                );
                return {
                    data: await deps.filterEvaluatorService.exportParticleFilterModel(readNativeParticleFilterModelRequest(payload))
                };
            }
        },
        {
            command: 'trajectory.plugin.property-names',
            execute: async (payload) => {
                deps.runtimeCapabilityGuard.ensureTrajectoryNativeEnabled('trajectory.plugin.property-names');
                return {
                    data: await deps.trajectoryPluginParserService.discoverPerAtomPropertyNames(readPluginPropertyNamesRequest(payload))
                };
            }
        },
        {
            command: 'trajectory.plugin.modifier-analysis',
            execute: async (payload) => {
                deps.runtimeCapabilityGuard.ensureTrajectoryNativeEnabled('trajectory.plugin.modifier-analysis');
                return {
                    data: await deps.trajectoryPluginParserService.getModifierAnalysisData(readPluginModifierAnalysisRequest(payload))
                };
            }
        },
        {
            command: 'trajectory.plugin.atom-index',
            execute: async (payload) => {
                deps.runtimeCapabilityGuard.ensureTrajectoryNativeEnabled('trajectory.plugin.atom-index');
                return {
                    data: await deps.trajectoryPluginParserService.buildPluginIndexForAtomIds(readPluginAtomIndexRequest(payload))
                };
            }
        },
        {
            command: 'trajectory.plugin.modifier-values',
            execute: async (payload) => {
                deps.runtimeCapabilityGuard.ensureTrajectoryNativeEnabled('trajectory.plugin.modifier-values');
                return {
                    data: await deps.trajectoryPluginParserService.getModifierValues(readPluginModifierValuesRequest(payload))
                };
            }
        },
        {
            command: 'trajectory.plugin.modifier-stats',
            execute: async (payload) => {
                deps.runtimeCapabilityGuard.ensureTrajectoryNativeEnabled('trajectory.plugin.modifier-stats');
                return {
                    data: await deps.trajectoryPluginParserService.getModifierStats(readPluginModifierStatsRequest(payload))
                };
            }
        },
        {
            command: 'trajectory.plugin.modifier-unique-values',
            execute: async (payload) => {
                deps.runtimeCapabilityGuard.ensureTrajectoryNativeEnabled('trajectory.plugin.modifier-unique-values');
                return {
                    data: await deps.trajectoryPluginParserService.getModifierUniqueValues(readPluginModifierUniqueValuesRequest(payload))
                };
            }
        },
        {
            command: 'trajectory.plugin.analysis-all-atoms',
            execute: async (payload) => {
                deps.runtimeCapabilityGuard.ensureTrajectoryNativeEnabled('trajectory.plugin.analysis-all-atoms');
                return {
                    data: await deps.trajectoryPluginParserService.getAnalysisAllPerAtomData(
                        readPluginAnalysisAllAtomsRequest(payload)
                    )
                };
            }
        }
    ];
};
