/**
 * Plain query functions for the TeamCluster model, replacing the deleted
 * TeamClusterRepository for the one custom query it used to expose
 * (`findByIdWithSensitiveData`) that is consumed from more than one call
 * site. ActiveRecord style: talks directly to TeamClusterModel, no
 * repository/mapper indirection.
 */
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
