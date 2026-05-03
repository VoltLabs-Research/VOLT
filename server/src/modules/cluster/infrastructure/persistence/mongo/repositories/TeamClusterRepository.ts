import TeamCluster, { TeamClusterProps, TeamClusterStatus } from '@modules/cluster/domain/entities/TeamCluster';
import type {
    ITeamClusterRepository,
    TeamClusterLifecycleUpdatePreconditions
} from '@modules/cluster/domain/port/ITeamClusterRepository';
import teamClusterMapper from '@modules/cluster/infrastructure/persistence/mongo/mappers/TeamClusterMapper';
import TeamClusterModel, { TeamClusterDocument } from '@modules/cluster/infrastructure/persistence/mongo/models/TeamClusterModel';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { MongooseBaseRepository } from '@shared/infrastructure/persistence/mongo/MongooseBaseRepository';
import type { FilterQuery, UpdateQuery } from 'mongoose';


const SENSITIVE_FIELDS_SELECTION = [
    '+enrollmentTokenHash',
    '+services.minio.username',
    '+services.minio.password',
    '+services.redis.username',
    '+services.redis.password',
    '+services.mongodb.username',
    '+services.mongodb.password',
    '+services.daemon.password'
].join(' ');

@Singleton()
export default class TeamClusterRepository
    extends MongooseBaseRepository<TeamCluster, TeamClusterProps, TeamClusterDocument>
    implements ITeamClusterRepository {

    constructor() {
        super(TeamClusterModel, teamClusterMapper);
    }

    async findByIdWithSensitiveData(teamClusterId: string): Promise<TeamCluster | null> {
        const document = await this.model.findById(teamClusterId)
            .select(SENSITIVE_FIELDS_SELECTION)
            .exec();

        return document ? this.mapper.toDomain(document) : null;
    }

    async findHeartbeatTimedOutConnectedClusters(cutoff: Date): Promise<TeamCluster[]> {
        const documents = await this.model.find({
            status: TeamClusterStatus.Connected,
            lastHeartbeatAt: {
                $lt: cutoff
            }
        }).exec();

        return documents.map((document) => this.mapper.toDomain(document));
    }

    async findHeartbeatTimedOutDeletingClusters(cutoff: Date): Promise<TeamCluster[]> {
        const documents = await this.model.find({
            status: TeamClusterStatus.Deleting,
            $or: [
                {
                    lastHeartbeatAt: {
                        $lt: cutoff
                    }
                },
                {
                    lastHeartbeatAt: null
                }
            ]
        }).exec();

        return documents.map((document) => this.mapper.toDomain(document));
    }

    async findDeletingTimedOutClusters(cutoff: Date): Promise<TeamCluster[]> {
        const documents = await this.model.find({
            status: TeamClusterStatus.Deleting,
            updatedAt: {
                $lt: cutoff
            }
        }).exec();

        return documents.map((document) => this.mapper.toDomain(document));
    }

    async hasTeamEverConnected(teamId: string): Promise<boolean> {
        return !!(await this.model.exists({
            team: teamId,
            lastHeartbeatAt: {
                $ne: null
            }
        }));
    }

    async findActiveDemoByTeamId(teamId: string): Promise<TeamCluster | null> {
        const document = await this.model.findOne({
            team: teamId,
            isDemo: true,
            status: {
                $nin: [TeamClusterStatus.Deleting, TeamClusterStatus.DeleteFailed]
            }
        }).exec();

        return document ? this.mapper.toDomain(document) : null;
    }

    async findActiveDemoByTeamIdWithSensitiveData(teamId: string): Promise<TeamCluster | null> {
        const document = await this.model.findOne({
            team: teamId,
            isDemo: true,
            status: {
                $nin: [TeamClusterStatus.Deleting, TeamClusterStatus.DeleteFailed]
            }
        })
            .select(SENSITIVE_FIELDS_SELECTION)
            .exec();

        return document ? this.mapper.toDomain(document) : null;
    }

    async findExpiredDemos(now: Date): Promise<TeamCluster[]> {
        const documents = await this.model.find({
            isDemo: true,
            demoExpiresAt: {
                $ne: null,
                $lte: now
            },
            status: {
                $nin: [TeamClusterStatus.Deleting, TeamClusterStatus.DeleteFailed]
            }
        }).exec();

        return documents.map((document) => this.mapper.toDomain(document));
    }

    async updateLifecycleById(
        teamClusterId: string,
        data: Partial<TeamClusterProps>,
        preconditions?: TeamClusterLifecycleUpdatePreconditions
    ): Promise<TeamCluster | null> {
        const filter: FilterQuery<TeamClusterDocument> = {
            _id: teamClusterId
        };

        if (preconditions?.allowedCurrentStatuses?.length) {
            filter.status = {
                $in: preconditions.allowedCurrentStatuses
            };
        }

        if (preconditions?.requireHeartbeatBefore) {
            filter.lastHeartbeatAt = {
                $lt: preconditions.requireHeartbeatBefore
            };
        }

        if (preconditions?.requireUpdatedBefore) {
            filter.updatedAt = {
                $lt: preconditions.requireUpdatedBefore
            };
        }

        const document = await this.model.findOneAndUpdate(
            filter,
            this.mapper.toPersistence(data) as UpdateQuery<TeamClusterDocument>,
            { new: true }
        ).exec();

        return document ? this.mapper.toDomain(document) : null;
    }
};
