import { Singleton } from '@shared/infrastructure/di/decorators';
import ClusterObjectUploadSessionModel from '@modules/cluster-object/infrastructure/persistence/mongo/models/ClusterObjectUploadSessionModel';

import type {
    ClusterObjectUploadSessionDocument,
    ClusterObjectUploadSessionFileProps,
    ClusterObjectUploadSessionStatus
} from '@modules/cluster-object/infrastructure/persistence/mongo/models/ClusterObjectUploadSessionModel';

export interface CreateClusterObjectUploadSessionInput {
    team: string;
    user: string;
    ownerClusterId: string;
    bucket: string;
    resourceKind: string;
    resourceId: string;
    files: ClusterObjectUploadSessionFileProps[];
    expiresAt: Date;
}

@Singleton()
export default class ClusterObjectUploadSessionRepository {
    async create(input: CreateClusterObjectUploadSessionInput): Promise<ClusterObjectUploadSessionDocument> {
        return ClusterObjectUploadSessionModel.create(input);
    }

    async findById(id: string): Promise<ClusterObjectUploadSessionDocument | null> {
        return ClusterObjectUploadSessionModel.findById(id).exec();
    }

    async markStatus(
        id: string,
        status: ClusterObjectUploadSessionStatus,
        extra: Partial<Pick<ClusterObjectUploadSessionDocument, 'committedAt'>> = {}
    ): Promise<void> {
        await ClusterObjectUploadSessionModel.findByIdAndUpdate(id, {
            status,
            ...extra
        }).exec();
    }
}
