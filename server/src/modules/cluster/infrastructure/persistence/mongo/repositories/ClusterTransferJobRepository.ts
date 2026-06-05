import { CLUSTER_TOKENS } from '@modules/cluster/infrastructure/di/ClusterTokens';
import type ClusterTransferJob from '@modules/cluster/domain/entities/ClusterTransferJob';
import type { ClusterTransferJobProps, ClusterTransferJobState } from '@modules/cluster/domain/entities/ClusterTransferJob';
import clusterTransferJobMapper from '@modules/cluster/infrastructure/persistence/mongo/mappers/ClusterTransferJobMapper';
import ClusterTransferJobModel, { ClusterTransferJobDocument } from '@modules/cluster/infrastructure/persistence/mongo/models/ClusterTransferJobModel';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { MongooseClaimableJobRepository } from '@shared/infrastructure/persistence/mongo/MongooseClaimableJobRepository';


const OPEN_TRANSFER_JOB_STATES: ClusterTransferJobState[] = [
    'queued',
    'freezing',
    'copying',
    'verifying',
    'switching',
    'cleaning'
];

@Singleton(CLUSTER_TOKENS.ClusterTransferJobRepository)
export default class ClusterTransferJobRepository
    extends MongooseClaimableJobRepository<ClusterTransferJob, ClusterTransferJobProps, ClusterTransferJobDocument> {

    constructor() {
        super(ClusterTransferJobModel, clusterTransferJobMapper, OPEN_TRANSFER_JOB_STATES);
    }

    async findOpenByScope(
        scopeType: ClusterTransferJobProps['scopeType'],
        scopeId: string
    ): Promise<ClusterTransferJob | null> {
        const document = await this.model.findOne({
            scopeType,
            scopeId,
            state: {
                $in: OPEN_TRANSFER_JOB_STATES
            }
        }).sort({
            createdAt: -1
        }).exec();

        return document ? this.mapper.toDomain(document) : null;
    }

    async findNextRunnable(): Promise<ClusterTransferJob | null> {
        const document = await this.model.findOne({
            state: {
                $in: OPEN_TRANSFER_JOB_STATES
            }
        }).sort({
            updatedAt: 1,
            createdAt: 1
        }).exec();

        return document ? this.mapper.toDomain(document) : null;
    }

    async listOpenByClusterIds(teamId: string, clusterIds: string[]): Promise<ClusterTransferJob[]> {
        const normalizedClusterIds = [...new Set(clusterIds.filter(Boolean))];

        if (normalizedClusterIds.length === 0) {
            return [];
        }

        const documents = await this.model.find({
            team: teamId,
            state: {
                $in: OPEN_TRANSFER_JOB_STATES
            },
            $or: [
                {
                    sourceClusterId: {
                        $in: normalizedClusterIds
                    }
                },
                {
                    destinationClusterId: {
                        $in: normalizedClusterIds
                    }
                }
            ]
        }).sort({
            updatedAt: -1,
            createdAt: -1
        }).exec();

        return documents.map((document) => this.mapper.toDomain(document));
    }

}
