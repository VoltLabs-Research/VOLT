
import TeamClusterModel, { toTeamClusterLike, type TeamCluster } from '@modules/cluster/models/TeamClusterModel';

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

export const findTeamClusterByIdWithSensitiveData = async (teamClusterId: string): Promise<TeamCluster | null> => {
    const document = await TeamClusterModel.findById(teamClusterId)
        .select(SENSITIVE_FIELDS_SELECTION)
        .exec();

    return document ? toTeamClusterLike(document) : null;
};
