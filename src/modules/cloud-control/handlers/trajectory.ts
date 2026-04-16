import { createTrajectoryRasterQueueService } from '@/modules/trajectory-native/services';
import { createTrajectoryGlbQueueService } from '@/modules/trajectory-native/services';
import type {
    FilterEvaluatorService,
    NativeAtomsPageRequest,
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
import type { QueueService } from '@/modules/platform/services';
import type { EnqueuePreprocessingRequest, RasterizeTrajectoryRequest } from '@/shared/contracts';
import { TEAM_CLUSTER_DAEMON_COMMAND } from '@/shared/contracts';
import type { ReverseChannelCommandHandler } from '../services';
import type { RuntimeCapabilityGuard } from '../services';
import type { ClusterObjectStore } from '@/shared/storage/ClusterObjectStore';
import {
    readPluginPropertyNamesRequest,
    readPluginModifierAnalysisRequest,
    readPluginAtomIndexRequest,
    readPluginModifierValuesRequest,
    readPluginModifierUniqueValuesRequest,
    readPluginAnalysisAllAtomsRequest
} from './payloadValidation';

interface TrajectoryHandlersDependencies {
    objectStore: ClusterObjectStore;
    queueService: QueueService;
    trajectoryAutoPreviewClaimStore: TrajectoryAutoPreviewClaimStore;
    trajectoryParserService: TrajectoryParserService;
    trajectoryPluginParserService: TrajectoryPluginParserService;
    glbExporterService: GlbExporterService;
    filterEvaluatorService: FilterEvaluatorService;
    runtimeCapabilityGuard: RuntimeCapabilityGuard;
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
                        payload as RasterizeTrajectoryRequest
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
                        payload as EnqueuePreprocessingRequest
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
                await deps.glbExporterService.preprocessTrajectory(payload as NativeTrajectoryRequest);
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
                    data: await deps.trajectoryParserService.getTrajectoryMetadata(payload as NativeTrajectoryRequest)
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
                    data: await deps.trajectoryParserService.getPropertyStats(payload as NativePropertyStatsRequest)
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
                    data: await deps.trajectoryParserService.getUniqueValues(payload as NativeUniqueValuesRequest)
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
                    data: await deps.trajectoryParserService.getAtomIds(payload as NativeTrajectoryRequest)
                };
            }
        },
        {
            command: TEAM_CLUSTER_DAEMON_COMMAND.trajectory.native.atoms,
            execute: async (payload) => {
                deps.runtimeCapabilityGuard.ensureTrajectoryNativeEnabled(
                    TEAM_CLUSTER_DAEMON_COMMAND.trajectory.native.atoms
                );
                const request = payload as NativeAtomsPageRequest & { analysisId?: string };
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
                    data: await deps.filterEvaluatorService.previewFilter(payload as NativeFilterPreviewRequest)
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
                    data: await deps.filterEvaluatorService.exportColoredModel(payload as NativeColorModelRequest)
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
                    data: await deps.filterEvaluatorService.exportParticleFilterModel(payload as NativeParticleFilterModelRequest)
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
                    data: await deps.trajectoryPluginParserService.getModifierStats(readPluginModifierValuesRequest(payload))
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
