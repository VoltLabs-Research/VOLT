import { injectable, inject } from 'tsyringe';
import { z } from 'zod';
import { AITool } from '@shared/application/ai/AITool';
import MarkAllUserNotificationsAsReadUseCase from '@modules/notification/application/use-cases/MarkAllUserNotificationsAsReadUseCase';

@injectable()
export class MarkNotificationsAsReadAITool extends AITool {
    readonly name = 'mark_notifications_as_read';
    readonly description = 'Mark all notifications as read.';
    readonly parameters = z.object({ reason: z.string().optional() });

    constructor(
        @inject(MarkAllUserNotificationsAsReadUseCase)
        protected readonly useCase: MarkAllUserNotificationsAsReadUseCase
    ) {
        super();
    }
}
