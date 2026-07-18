import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import NotificationService from '@modules/notification/services/NotificationService';
import { AITool } from '@shared/application/ai/AITool';
import { z } from 'zod';

export class GetNotificationsAITool extends AITool {
    readonly name = 'get_notifications';
    readonly description =
        'List the current user\'s notifications (newest first), optionally filtered to only unread ones.';
    readonly parameters = z.object({
        page: z.number().optional().default(1),
        limit: z.number().optional().default(20),
        unreadOnly: z.boolean().optional().describe('When true, return only notifications that have not been read yet.')
    });

    #service = new NotificationService();

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const value = await this.#service.getMyNotifications({
            userId: scope.userId,
            page: params.page,
            limit: params.limit
        });

        const unreadCount = value.data.reduce((count, notification) => count + (notification.read ? 0 : 1), 0);

        const notifications = params.unreadOnly
            ? value.data.filter((notification) => !notification.read)
            : value.data;

        return {
            summary: `Returned ${notifications.length} notification(s) (${unreadCount} unread on this page).`,
            data: {
                notifications,
                total: value.total,
                page: value.page,
                limit: value.limit,
                totalPages: value.totalPages
            }
        };
    }
}
