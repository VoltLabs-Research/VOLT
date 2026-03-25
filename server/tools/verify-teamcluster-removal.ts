import 'dotenv/config';
import mongoose from 'mongoose';
import mongoConnector from '../src/shared/infrastructure/utilities/mongo-connector';
import AnalysisModel from '../src/modules/analysis/infrastructure/persistence/mongo/models/AnalysisModel';
import PluginModel from '../src/modules/plugin/infrastructure/persistence/mongo/models/plugin/PluginModel';
import StoragePlacementModel from '../src/modules/team-cluster/infrastructure/persistence/mongo/models/StoragePlacementModel';
import SceneArtifactModel from '../src/modules/trajectory/infrastructure/persistence/mongo/models/scene-artifacts/SceneArtifactModel';
import TrajectoryModel from '../src/modules/trajectory/infrastructure/persistence/mongo/models/trajectory/TrajectoryModel';
import { VOLT_SERVER_OBJECT_OWNER_CLUSTER_ID } from '../src/shared/infrastructure/contracts/team-cluster';

interface LegacyRecord {
    _id: unknown;
    workflow?: unknown;
}

const count = async (
    label: string,
    promise: Promise<number>
): Promise<[string, number]> => {
    return [label, await promise];
};

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

const countPlacementOwnerMismatches = async (input: {
    collection: mongoose.Collection;
    ownerField: string;
    scopeType: 'trajectory' | 'analysis';
}): Promise<number> => {
    const result = await input.collection.aggregate([
        {
            $match: {
                [input.ownerField]: { $exists: true, $ne: null }
            }
        },
        {
            $project: {
                scopeId: { $toString: '$_id' },
                ownerClusterId: { $toString: `$${input.ownerField}` }
            }
        },
        {
            $lookup: {
                from: StoragePlacementModel.collection.name,
                let: {
                    scopeId: '$scopeId',
                    ownerClusterId: '$ownerClusterId'
                },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ['$scopeType', input.scopeType] },
                                    { $eq: ['$scopeId', '$$scopeId'] },
                                    { $eq: ['$primaryClusterId', '$$ownerClusterId'] }
                                ]
                            }
                        }
                    },
                    {
                        $limit: 1
                    }
                ],
                as: 'placements'
            }
        },
        {
            $match: {
                'placements.0': { $exists: false }
            }
        },
        {
            $count: 'count'
        }
    ]).toArray();

    return typeof result[0]?.count === 'number' ? result[0].count : 0;
};

const countMissingPluginBinaryPlacements = async (): Promise<number> => {
    let missingCount = 0;
    const cursor = PluginModel.collection.find<LegacyRecord>(
        {},
        {
            projection: {
                _id: 1,
                workflow: 1
            }
        }
    );

    for await (const plugin of cursor) {
        const pluginId = asString(plugin._id);
        const binaryObjectPath = extractPluginBinaryObjectPath(plugin.workflow);

        if (!pluginId || !binaryObjectPath) {
            continue;
        }

        const placement = await StoragePlacementModel.collection.findOne(
            {
                scopeType: 'plugin-binary',
                scopeId: pluginId,
                primaryClusterId: VOLT_SERVER_OBJECT_OWNER_CLUSTER_ID
            },
            {
                projection: { _id: 1 }
            }
        );

        if (!placement) {
            missingCount += 1;
        }
    }

    return missingCount;
};

const main = async (): Promise<void> => {
    await mongoConnector();

    const entries = await Promise.all([
        count('trajectoriesMissingStorageClusterId', TrajectoryModel.countDocuments({
            $or: [
                { storageClusterId: { $exists: false } },
                { storageClusterId: null }
            ]
        })),
        count('analysesMissingComputeClusterId', AnalysisModel.countDocuments({
            $or: [
                { computeClusterId: { $exists: false } },
                { computeClusterId: null }
            ]
        })),
        count('analysesMissingStorageClusterId', AnalysisModel.countDocuments({
            $or: [
                { storageClusterId: { $exists: false } },
                { storageClusterId: null }
            ]
        })),
        count('sceneArtifactsMissingStorageClusterId', SceneArtifactModel.countDocuments({
            $or: [
                { storageClusterId: { $exists: false } },
                { storageClusterId: null }
            ]
        })),
        count('legacyTrajectoryTeamClusterDocs', TrajectoryModel.countDocuments({
            teamCluster: { $exists: true }
        })),
        count('legacyAnalysisTeamClusterDocs', AnalysisModel.countDocuments({
            teamCluster: { $exists: true }
        })),
        count('legacySceneArtifactTeamClusterDocs', SceneArtifactModel.countDocuments({
            teamCluster: { $exists: true }
        })),
        count('legacyPluginTeamClusterDocs', PluginModel.countDocuments({
            teamCluster: { $exists: true }
        })),
        count('pluginBinaryPlacementsMissingServerOwner', StoragePlacementModel.countDocuments({
            scopeType: 'plugin-binary',
            primaryClusterId: { $ne: VOLT_SERVER_OBJECT_OWNER_CLUSTER_ID }
        })),
        count('trajectoryPlacementsOutOfSync', countPlacementOwnerMismatches({
            collection: TrajectoryModel.collection,
            ownerField: 'storageClusterId',
            scopeType: 'trajectory'
        })),
        count('analysisPlacementsOutOfSync', countPlacementOwnerMismatches({
            collection: AnalysisModel.collection,
            ownerField: 'storageClusterId',
            scopeType: 'analysis'
        })),
        count('pluginBinaryPlacementsMissing', countMissingPluginBinaryPlacements())
    ]);

    const report = Object.fromEntries(entries);
    const failingEntries = Object.entries(report).filter(([, value]) => value > 0);

    console.log(JSON.stringify({
        ok: failingEntries.length === 0,
        report
    }, null, 2));

    if (failingEntries.length > 0) {
        process.exitCode = 1;
    }
};

main()
    .then(async () => {
        await mongoose.disconnect();
    })
    .catch(async (error) => {
        console.error('[verify-teamcluster-removal] Error:', error);
        await mongoose.disconnect().catch(() => undefined);
        process.exit(1);
    });
