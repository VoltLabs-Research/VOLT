import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import WhiteboardService from '@modules/whiteboards/services/WhiteboardService';
import { AITool } from '@shared/application/ai/AITool';
import { z } from 'zod';

export class ListWhiteboardsAITool extends AITool {
    readonly name = 'list_whiteboards';
    readonly description = 'List all whiteboards in the team.';
    readonly parameters = z.object({
        page: z.number().optional().default(1),
        limit: z.number().optional().default(50),
        folderId: z.string().optional()
    });

    #service = new WhiteboardService();

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const value = await this.#service.listWhiteboards(scope.teamId, {
            page: params.page,
            limit: params.limit,
            folderId: params.folderId
        });
        return { summary: `Found ${value.total} whiteboards.`, data: value.data };
    }
}
