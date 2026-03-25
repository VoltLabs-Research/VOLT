import 'dotenv/config';
import mongoose from 'mongoose';
import mongoConnector from '../src/shared/infrastructure/utilities/mongo-connector';
import AnalysisModel from '../src/modules/analysis/infrastructure/persistence/mongo/models/AnalysisModel';
import PluginModel from '../src/modules/plugin/infrastructure/persistence/mongo/models/plugin/PluginModel';
import TeamClusterModel from '../src/modules/team-cluster/infrastructure/persistence/mongo/models/TeamClusterModel';
import StoragePlacementModel from '../src/modules/team-cluster/infrastructure/persistence/mongo/models/StoragePlacementModel';
import {
    createDefaultTeamClusterEffectiveCapabilities,
    createDefaultTeamClusterRoleConfig
} from '../src/modules/team-cluster/domain/entities/TeamCluster';
import {
    buildAnalysisPlacementBuckets,
    buildPluginBinaryPlacementBuckets,
    buildTrajectoryPlacementBuckets
} from '../src/modules/team-cluster/application/utilities/storage-placement-targets';
import SceneArtifactModel from '../src/modules/trajectory/infrastructure/persistence/mongo/models/scene-artifacts/SceneArtifactModel';
import TrajectoryModel from '../src/modules/trajectory/infrastructure/persistence/mongo/models/trajectory/TrajectoryModel';
import { VOLT_SERVER_OBJECT_OWNER_CLUSTER_ID } from '../src/shared/infrastructure/contracts/team-cluster';

interface LegacyRecord {
    _id: unknown;
    team?: unknown;
    teamCluster?: unknown;
    storageClusterId?: unknown;
    computeClusterId?: unknown;
    trajectory?: unknown;
    roleConfig?: unknown;
    effectiveCapabilities?: unknown;
    workflow?: unknown;
}

const asString = (value: unknown): string | undefined => {
    if (typeof value === 'string' && value.length > 0) {
        return value;
    }

    if (value && typeof value === 'object' && 'toString' in value && typeof value.toString === 'function') {
        const resolved = value.toString();
        return resolved.length > 0 ? resolved : undefined;
    }

    return undefined;
};

const migrateTeamClusterRoleDefaults = async (): Promise<number> => {
    const roleConfig = createDefaultTeamClusterRoleConfig();
    const effectiveCapabilities = createDefaultTeamClusterEffectiveCapabilities();

    const result = await TeamClusterModel.collection.updateMany(
        {
            $or: [
                { roleConfig: { $exists: false } },
                { roleConfig: null },
                { effectiveCapabilities: { $exists: false } },
                { effectiveCapabilities: null }
            ]
        },
        {
            $set: {
                roleConfig,
                effectiveCapabilities
            }
        }
    );

    return result.modifiedCount ?? 0;
};

const migrateTrajectoryStorageClusterIds = async (): Promise<number> => {
    const result = await TrajectoryModel.collection.updateMany(
        {
            $or: [
                { storageClusterId: { $exists: false } },
                { storageClusterId: null }
            ],
            teamCluster: { $exists: true, $ne: null }
        },
        [
            {
                $set: {
                    storageClusterId: '$teamCluster'
                }
            }
        ]
    );

    return result.modifiedCount ?? 0;
};

const migrateSceneArtifactStorageClusterIds = async (): Promise<number> => {
    const result = await SceneArtifactModel.collection.updateMany(
        {
            $or: [
                { storageClusterId: { $exists: false } },
                { storageClusterId: null }
            ],
            teamCluster: { $exists: true, $ne: null }
        },
        [
            {
                $set: {
                    storageClusterId: '$teamCluster'
                }
            }
        ]
    );

    return result.modifiedCount ?? 0;
};

const buildTrajectoryStorageClusterResolver = () => {
    const cache = new Map<string, string | null>();

    return async (trajectoryId: string | undefined): Promise<string | undefined> => {
        if (!trajectoryId) {
            return undefined;
        }

        if (cache.has(trajectoryId)) {
            const cached = cache.get(trajectoryId);
            return cached ?? undefined;
        }

        const trajectory = await TrajectoryModel.collection.findOne<LegacyRecord>(
            { _id: new mongoose.Types.ObjectId(trajectoryId) },
            {
                projection: {
                    storageClusterId: 1,
                    teamCluster: 1
                }
            }
        );
        const storageClusterId = asString(trajectory?.storageClusterId) ?? asString(trajectory?.teamCluster);
        cache.set(trajectoryId, storageClusterId ?? null);

        return storageClusterId;
    };
};

const migrateAnalysisClusterIds = async (): Promise<number> => {
    let migratedCount = 0;
    const resolveTrajectoryStorageClusterId = buildTrajectoryStorageClusterResolver();

    const cursor = AnalysisModel.collection.find<LegacyRecord>(
        {
            $or: [
                { computeClusterId: { $exists: false } },
                { computeClusterId: null },
                { storageClusterId: { $exists: false } },
                { storageClusterId: null }
            ]
        },
        {
            projection: {
                _id: 1,
                teamCluster: 1,
                computeClusterId: 1,
                storageClusterId: 1,
                trajectory: 1
            }
        }
    );

    for await (const analysis of cursor) {
        const computeClusterId = asString(analysis.computeClusterId) ?? asString(analysis.teamCluster);
        const storageClusterId = asString(analysis.storageClusterId)
            ?? await resolveTrajectoryStorageClusterId(asString(analysis.trajectory));
        const nextSet: Record<string, string> = {};

        if (!asString(analysis.computeClusterId) && computeClusterId) {
            nextSet.computeClusterId = computeClusterId;
        }

        if (!asString(analysis.storageClusterId) && storageClusterId) {
            nextSet.storageClusterId = storageClusterId;
        }

        if (!Object.keys(nextSet).length) {
            continue;
        }

        await AnalysisModel.collection.updateOne(
            { _id: analysis._id as mongoose.Types.ObjectId },
            {
                $set: nextSet
            }
        );

        migratedCount += 1;
    }

    return migratedCount;
};

const extractPluginBinaryObjectPath = (workflow: unknown): string | undefined => {
    if (!workflow || typeof workflow !== 'object' || !('nodes' in workflow) || !Array.isArray(workflow.nodes)) {
        return undefined;
    }

    for (const node of workflow.nodes) {
        if (!node || typeof node !== 'object' || !('type' in node)) {
            continue;
        }

        const typedNode = node as Record<string, unknown>;
        if (typedNode.type !== 'entrypoint') {
            continue;
        }

        if (!typedNode.data || typeof typedNode.data !== 'object') {
            continue;
        }

        const data = typedNode.data as Record<string, unknown>;
        if (!data.entrypoint || typeof data.entrypoint !== 'object') {
            continue;
        }

        const entrypoint = data.entrypoint as Record<string, unknown>;
        return asString(entrypoint.binaryObjectPath);
    }

    return undefined;
};

const upsertStoragePlacement = async (input: {
    teamId: string;
    scopeType: 'trajectory' | 'analysis' | 'plugin-binary';
    scopeId: string;
    primaryClusterId: string;
    buckets: Array<{ bucket: string; prefix: string; }>;
}): Promise<void> => {
    const now = new Date();

    await StoragePlacementModel.collection.updateOne(
        {
            scopeType: input.scopeType,
            scopeId: input.scopeId
        },
        {
            $set: {
                team: new mongoose.Types.ObjectId(input.teamId),
                primaryClusterId: input.primaryClusterId,
                buckets: input.buckets,
                updatedAt: now
            },
            $setOnInsert: {
                scopeType: input.scopeType,
                scopeId: input.scopeId,
                replicaClusterIds: [],
                state: 'active',
                lastVerifiedAt: null,
                bytesUsed: null,
                lastAccessedAt: null,
                createdAt: now
            }
        },
        {
            upsert: true
        }
    );
};

const migrateTrajectoryPlacements = async (): Promise<number> => {
    let migratedCount = 0;
    const cursor = TrajectoryModel.collection.find<LegacyRecord>({}, {
        projection: {
            _id: 1,
            team: 1,
            storageClusterId: 1,
            teamCluster: 1
        }
    });

    for await (const trajectory of cursor) {
        const trajectoryId = asString(trajectory._id);
        const teamId = asString(trajectory.team);
        const storageClusterId = asString(trajectory.storageClusterId) ?? asString(trajectory.teamCluster);

        if (!trajectoryId || !teamId || !storageClusterId) {
            continue;
        }

        await upsertStoragePlacement({
            teamId,
            scopeType: 'trajectory',
            scopeId: trajectoryId,
            primaryClusterId: storageClusterId,
            buckets: buildTrajectoryPlacementBuckets(trajectoryId)
        });
        migratedCount += 1;
    }

    return migratedCount;
};

const migrateAnalysisPlacements = async (): Promise<number> => {
    let migratedCount = 0;
    const resolveTrajectoryStorageClusterId = buildTrajectoryStorageClusterResolver();
    const cursor = AnalysisModel.collection.find<LegacyRecord>({}, {
        projection: {
            _id: 1,
            team: 1,
            trajectory: 1,
            storageClusterId: 1
        }
    });

    for await (const analysis of cursor) {
        const analysisId = asString(analysis._id);
        const teamId = asString(analysis.team);
        const trajectoryId = asString(analysis.trajectory);
        const storageClusterId = asString(analysis.storageClusterId)
            ?? await resolveTrajectoryStorageClusterId(trajectoryId);

        if (!analysisId || !teamId || !trajectoryId || !storageClusterId) {
            continue;
        }

        await upsertStoragePlacement({
            teamId,
            scopeType: 'analysis',
            scopeId: analysisId,
            primaryClusterId: storageClusterId,
            buckets: buildAnalysisPlacementBuckets(trajectoryId, analysisId)
        });
        migratedCount += 1;
    }

    return migratedCount;
};

const migratePluginBinaryPlacements = async (): Promise<number> => {
    let migratedCount = 0;
    const cursor = PluginModel.collection.find<LegacyRecord>({}, {
        projection: {
            _id: 1,
            team: 1,
            workflow: 1
        }
    });

    for await (const plugin of cursor) {
        const pluginId = asString(plugin._id);
        const teamId = asString(plugin.team);
        const binaryObjectPath = extractPluginBinaryObjectPath(plugin.workflow);

        if (!pluginId || !teamId || !binaryObjectPath) {
            continue;
        }

        await upsertStoragePlacement({
            teamId,
            scopeType: 'plugin-binary',
            scopeId: pluginId,
            primaryClusterId: VOLT_SERVER_OBJECT_OWNER_CLUSTER_ID,
            buckets: buildPluginBinaryPlacementBuckets(pluginId)
        });
        migratedCount += 1;
    }

    return migratedCount;
};

const removeLegacyTrajectoryTeamClusterField = async (): Promise<number> => {
    const result = await TrajectoryModel.collection.updateMany(
        {
            teamCluster: { $exists: true },
            storageClusterId: { $exists: true, $ne: null }
        },
        {
            $unset: {
                teamCluster: ''
            }
        }
    );

    return result.modifiedCount ?? 0;
};

const removeLegacyAnalysisTeamClusterField = async (): Promise<number> => {
    const result = await AnalysisModel.collection.updateMany(
        {
            teamCluster: { $exists: true },
            computeClusterId: { $exists: true, $ne: null },
            storageClusterId: { $exists: true, $ne: null }
        },
        {
            $unset: {
                teamCluster: ''
            }
        }
    );

    return result.modifiedCount ?? 0;
};

const removeLegacySceneArtifactTeamClusterField = async (): Promise<number> => {
    const result = await SceneArtifactModel.collection.updateMany(
        {
            teamCluster: { $exists: true },
            storageClusterId: { $exists: true, $ne: null }
        },
        {
            $unset: {
                teamCluster: ''
            }
        }
    );

    return result.modifiedCount ?? 0;
};

const removeLegacyPluginTeamClusterField = async (): Promise<number> => {
    const result = await PluginModel.collection.updateMany(
        {
            teamCluster: { $exists: true }
        },
        {
            $unset: {
                teamCluster: ''
            }
        }
    );

    return result.modifiedCount ?? 0;
};

const main = async (): Promise<void> => {
    await mongoConnector();

    const migratedTeamClusterRoles = await migrateTeamClusterRoleDefaults();
    const migratedTrajectoryStorageClusterIds = await migrateTrajectoryStorageClusterIds();
    const migratedAnalysisClusterIds = await migrateAnalysisClusterIds();
    const migratedSceneArtifactStorageClusterIds = await migrateSceneArtifactStorageClusterIds();
    const migratedTrajectoryPlacements = await migrateTrajectoryPlacements();
    const migratedAnalysisPlacements = await migrateAnalysisPlacements();
    const migratedPluginBinaryPlacements = await migratePluginBinaryPlacements();
    const removedLegacyTrajectoryTeamClusterField = await removeLegacyTrajectoryTeamClusterField();
    const removedLegacyAnalysisTeamClusterField = await removeLegacyAnalysisTeamClusterField();
    const removedLegacySceneArtifactTeamClusterField = await removeLegacySceneArtifactTeamClusterField();
    const removedLegacyPluginTeamClusterField = await removeLegacyPluginTeamClusterField();

    console.log(JSON.stringify({
        migratedTeamClusterRoles,
        migratedTrajectoryStorageClusterIds,
        migratedAnalysisClusterIds,
        migratedSceneArtifactStorageClusterIds,
        migratedTrajectoryPlacements,
        migratedAnalysisPlacements,
        migratedPluginBinaryPlacements,
        removedLegacyTrajectoryTeamClusterField,
        removedLegacyAnalysisTeamClusterField,
        removedLegacySceneArtifactTeamClusterField,
        removedLegacyPluginTeamClusterField
    }, null, 2));
};

main()
    .then(async () => {
        await mongoose.disconnect();
        process.exit(0);
    })
    .catch(async (error) => {
        console.error('[cluster-role-architecture-v1-migration] Error:', error);
        await mongoose.disconnect().catch(() => undefined);
        process.exit(1);
    });
