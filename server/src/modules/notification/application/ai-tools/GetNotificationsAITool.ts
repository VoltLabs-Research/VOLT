import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import GetMyNotificationsUseCase from '@modules/notification/application/use-cases/GetMyNotificationsUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOOL_TOKENS.AITool)
export class GetNotificationsAITool extends AITool {
    readonly name = 'get_notifications';
    readonly description =
        'List the current user\'s notifications (newest first), optionally filtered to only unread ones.';
    readonly parameters = z.object({
        page: z.number().optional().default(1),
        limit: z.number().optional().default(20),
        unreadOnly: z.boolean().optional().describe('When true, return only notifications that have not been read yet.')
    });

    constructor(
        protected readonly useCase: GetMyNotificationsUseCase
    ) {
        super();
    }

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const result = await this.useCase.execute({
            userId: scope.userId,
            page: params.page,
            limit: params.limit
        });
        if (!result.success) throw result.error;

        const unreadCount = result.value.data.reduce((count, notification) => count + (notification.read ? 0 : 1), 0);

        const notifications = params.unreadOnly
            ? result.value.data.filter((notification) => !notification.read)
            : result.value.data;

        return {
            summary: `Returned ${notifications.length} notification(s) (${unreadCount} unread on this page).`,
            data: {
                notifications,
                total: result.value.total,
                page: result.value.page,
                limit: result.value.limit,
                totalPages: result.value.totalPages
            }
        };
    }
}
