import type { EnqueuePreprocessingRequest, RasterizeTrajectoryRequest } from '@/contracts';
import { ChannelCommands } from '@/contracts';
import type { ReverseChannelCommandHandler } from '@/core/reverse-channel/contracts/commandHandler';
import type { NativeAtomsPageRequest, NativeColorModelRequest, NativeFilterPreviewRequest, NativeParticleFilterModelRequest, NativePropertyStatsRequest, NativeTrajectoryRequest, NativeUniqueValuesRequest } from '@/core/runtime/infrastructure/native/NativeModuleLoader';
import type { RuntimeCapabilityGuard } from '@/core/runtime/application/RuntimeCapabilityGuard';
import type { ClusterObjectStore } from '@/core/storage/application/ClusterObjectStore';
import { createTrajectoryGlbQueueService } from '@/modules/trajectory/application/glb/TrajectoryGlbQueueService';
import type { GlbExporterService } from '@/modules/trajectory/application/glb/GlbExporterService';
import type { TrajectoryParserService } from '@/modules/trajectory/application/parsing/TrajectoryParserService';
import type { TrajectoryPluginParserService } from '@/modules/trajectory/application/parsing/TrajectoryPluginParserService';
import { createTrajectoryRasterQueueService } from '@/modules/trajectory/application/raster/TrajectoryRasterQueueService';
import type { FilterEvaluatorService } from '@/modules/trajectory/domain/services/FilterEvaluatorService';
import type { QueueService } from '@/core/queues/application/QueueService';
import type { TrajectoryAutoPreviewClaimStore } from '@/modules/trajectory/infrastructure/storage/TrajectoryAutoPreviewClaimStore';

interface TrajectoryHandlersDependencies {
    objectStore: ClusterObjectStore;
    queueService: QueueService;
    trajectoryAutoPreviewClaimStore: TrajectoryAutoPreviewClaimStore;
    trajectoryParserService: TrajectoryParserService;
    trajectoryPluginParserService: TrajectoryPluginParserService;
    glbExporterService: GlbExporterService;
    filterEvaluatorService: FilterEvaluatorService;
    runtimeCapabilityGuard: RuntimeCapabilityGuard;
}

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
            command: ChannelCommands.TrajectoryRasterize,
            execute: async (payload) => {
                deps.runtimeCapabilityGuard.ensureAcceptsComputeJobs(ChannelCommands.TrajectoryRasterize);
                return {
                    data: await trajectoryRasterQueueService.queueRasterizationJobs(payload as RasterizeTrajectoryRequest)
                };
            }
        },
        {
            command: ChannelCommands.TrajectoryEnqueuePreprocessing,
            execute: async (payload) => {
                deps.runtimeCapabilityGuard.ensureAcceptsComputeJobs(
                    ChannelCommands.TrajectoryEnqueuePreprocessing
                );
                return {
                    data: await trajectoryGlbQueueService.enqueueGlbConversionJobs(payload as EnqueuePreprocessingRequest)
                };
            }
        },
        {
            command: ChannelCommands.TrajectoryNativePreprocess,
            execute: async (payload) => {
                deps.runtimeCapabilityGuard.ensureTrajectoryNativeEnabled(
                    ChannelCommands.TrajectoryNativePreprocess
                );
                await deps.glbExporterService.preprocessTrajectory(payload as NativeTrajectoryRequest);
                return { data: { glbExported: true } };
            }
        },
        {
            command: ChannelCommands.TrajectoryNativeMetadata,
            execute: async (payload) => {
                deps.runtimeCapabilityGuard.ensureTrajectoryNativeEnabled(ChannelCommands.TrajectoryNativeMetadata);
                return {
                    data: await deps.trajectoryParserService.getTrajectoryMetadata(payload as NativeTrajectoryRequest)
                };
            }
        },
        {
            command: ChannelCommands.TrajectoryNativePropertyStats,
            execute: async (payload) => {
                deps.runtimeCapabilityGuard.ensureTrajectoryNativeEnabled(
                    ChannelCommands.TrajectoryNativePropertyStats
                );
                return {
                    data: await deps.trajectoryParserService.getPropertyStats(payload as NativePropertyStatsRequest)
                };
            }
        },
        {
            command: ChannelCommands.TrajectoryNativeUniqueValues,
            execute: async (payload) => {
                deps.runtimeCapabilityGuard.ensureTrajectoryNativeEnabled(
                    ChannelCommands.TrajectoryNativeUniqueValues
                );
                return {
                    data: await deps.trajectoryParserService.getUniqueValues(payload as NativeUniqueValuesRequest)
                };
            }
        },
        {
            command: ChannelCommands.TrajectoryNativeAtomIds,
            execute: async (payload) => {
                deps.runtimeCapabilityGuard.ensureTrajectoryNativeEnabled(ChannelCommands.TrajectoryNativeAtomIds);
                return {
                    data: await deps.trajectoryParserService.getAtomIds(payload as NativeTrajectoryRequest)
                };
            }
        },
        {
            command: ChannelCommands.TrajectoryNativeAtoms,
            execute: async (payload) => {
                deps.runtimeCapabilityGuard.ensureTrajectoryNativeEnabled(ChannelCommands.TrajectoryNativeAtoms);
                const request = payload as NativeAtomsPageRequest & { analysisId?: string };
                const nativeResult = await deps.trajectoryParserService.getAtomsPage(request);

                if (!request.analysisId) {
                    return { data: nativeResult };
                }

                const pageAtomIds = new Set<number>(
                    nativeResult.atoms.map((atom: Record<string, unknown>) => Number(atom.id))
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
            command: ChannelCommands.TrajectoryNativeFilterPreview,
            execute: async (payload) => {
                deps.runtimeCapabilityGuard.ensureTrajectoryNativeEnabled(
                    ChannelCommands.TrajectoryNativeFilterPreview
                );
                return {
                    data: await deps.filterEvaluatorService.previewFilter(payload as NativeFilterPreviewRequest)
                };
            }
        },
        {
            command: ChannelCommands.TrajectoryNativeColorModel,
            execute: async (payload) => {
                deps.runtimeCapabilityGuard.ensureTrajectoryNativeEnabled(
                    ChannelCommands.TrajectoryNativeColorModel
                );
                return {
                    data: await deps.filterEvaluatorService.exportColoredModel(payload as NativeColorModelRequest)
                };
            }
        },
        {
            command: ChannelCommands.TrajectoryNativeParticleFilterModel,
            execute: async (payload) => {
                deps.runtimeCapabilityGuard.ensureTrajectoryNativeEnabled(
                    ChannelCommands.TrajectoryNativeParticleFilterModel
                );
                return {
                    data: await deps.filterEvaluatorService.exportParticleFilterModel(
                        payload as NativeParticleFilterModelRequest
                    )
                };
            }
        },
        {
            command: 'trajectory.plugin.property-names',
            execute: async (payload) => {
                deps.runtimeCapabilityGuard.ensureTrajectoryNativeEnabled('trajectory.plugin.property-names');
                return {
                    data: await deps.trajectoryPluginParserService.discoverPerAtomPropertyNames(
                        payload as Parameters<TrajectoryPluginParserService['discoverPerAtomPropertyNames']>[0]
                    )
                };
            }
        },
        {
            command: 'trajectory.plugin.modifier-analysis',
            execute: async (payload) => {
                deps.runtimeCapabilityGuard.ensureTrajectoryNativeEnabled('trajectory.plugin.modifier-analysis');
                return {
                    data: await deps.trajectoryPluginParserService.getModifierAnalysisData(
                        payload as Parameters<TrajectoryPluginParserService['getModifierAnalysisData']>[0]
                    )
                };
            }
        },
        {
            command: 'trajectory.plugin.atom-index',
            execute: async (payload) => {
                deps.runtimeCapabilityGuard.ensureTrajectoryNativeEnabled('trajectory.plugin.atom-index');
                return {
                    data: await deps.trajectoryPluginParserService.buildPluginIndexForAtomIds(
                        payload as Parameters<TrajectoryPluginParserService['buildPluginIndexForAtomIds']>[0]
                    )
                };
            }
        },
        {
            command: 'trajectory.plugin.modifier-values',
            execute: async (payload) => {
                deps.runtimeCapabilityGuard.ensureTrajectoryNativeEnabled('trajectory.plugin.modifier-values');
                return {
                    data: await deps.trajectoryPluginParserService.getModifierValues(
                        payload as Parameters<TrajectoryPluginParserService['getModifierValues']>[0]
                    )
                };
            }
        },
        {
            command: 'trajectory.plugin.modifier-stats',
            execute: async (payload) => {
                deps.runtimeCapabilityGuard.ensureTrajectoryNativeEnabled('trajectory.plugin.modifier-stats');
                return {
                    data: await deps.trajectoryPluginParserService.getModifierStats(
                        payload as Parameters<TrajectoryPluginParserService['getModifierStats']>[0]
                    )
                };
            }
        },
        {
            command: 'trajectory.plugin.modifier-unique-values',
            execute: async (payload) => {
                deps.runtimeCapabilityGuard.ensureTrajectoryNativeEnabled('trajectory.plugin.modifier-unique-values');
                return {
                    data: await deps.trajectoryPluginParserService.getModifierUniqueValues(
                        payload as Parameters<TrajectoryPluginParserService['getModifierUniqueValues']>[0]
                    )
                };
            }
        },
        {
            command: 'trajectory.plugin.analysis-all-atoms',
            execute: async (payload) => {
                deps.runtimeCapabilityGuard.ensureTrajectoryNativeEnabled('trajectory.plugin.analysis-all-atoms');
                return {
                    data: await deps.trajectoryPluginParserService.getAnalysisAllPerAtomData(
                        payload as Parameters<TrajectoryPluginParserService['getAnalysisAllPerAtomData']>[0]
                    )
                };
            }
        }
    ];
};
