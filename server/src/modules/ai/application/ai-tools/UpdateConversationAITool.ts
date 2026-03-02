import { injectable } from 'tsyringe';
import { z } from 'zod';
import { AITool } from '@shared/application/ai/AITool';

@injectable()
export class UpdateConversationAITool extends AITool {
    readonly name = 'update_conversation';
    readonly description = 'Update an AI conversation title.';
    readonly parameters = z.object({ conversationId: z.string(), title: z.string().optional(), reason: z.string().optional() });
    protected needsApproval = true;

    constructor() {
        super();
    }
}
