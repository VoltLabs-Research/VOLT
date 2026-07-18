import NotificationModel from '@modules/notification/models/NotificationModel';

export default class NotificationRepository {
    async deleteMany(filter: Record<string, string>): Promise<number> {
        const result = await NotificationModel.deleteMany(filter);
        return result.deletedCount ?? 0;
    }
}
