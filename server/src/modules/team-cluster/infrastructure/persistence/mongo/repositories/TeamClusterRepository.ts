import TeamCluster, { TeamClusterProps, TeamClusterStatus, TeamClusterRole } from '@modules/team-cluster/domain/entities/TeamCluster';
import type { ITeamClusterRepository } from '@modules/team-cluster/domain/port/ITeamClusterRepository';
import teamClusterMapper from '@modules/team-cluster/infrastructure/persistence/mongo/mappers/TeamClusterMapper';
import TeamClusterModel, { TeamClusterDocument } from '@modules/team-cluster/infrastructure/persistence/mongo/models/TeamClusterModel';
import { MongooseBaseRepository } from '@shared/infrastructure/persistence/mongo/MongooseBaseRepository';
import { injectable } from 'tsyringe';

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

@injectable()
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
            lastHeartbeatAt: {
                $lt: cutoff
            }
        }).exec();

        return documents.map((document) => this.mapper.toDomain(document));
    }

    async findUpdatingTimedOutClusters(cutoff: Date): Promise<TeamCluster[]> {
        const documents = await this.model.find({
            status: TeamClusterStatus.Updating,
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

    async findStorageClusterForTeam(teamId: string): Promise<TeamCluster | null> {
        // Prefer dedicated StorageServer first
        let document = await this.model.findOne({
            team: teamId,
            status: TeamClusterStatus.Connected,
            role: TeamClusterRole.StorageServer
        })
        .select(SENSITIVE_FIELDS_SELECTION)
        .exec();

        // Fall back to any Cluster-role node
        if (!document) {
            document = await this.model.findOne({
                team: teamId,
                status: TeamClusterStatus.Connected,
                role: TeamClusterRole.Cluster
            })
            .select(SENSITIVE_FIELDS_SELECTION)
            .exec();
        }

        return document ? this.mapper.toDomain(document) : null;
    }
};
