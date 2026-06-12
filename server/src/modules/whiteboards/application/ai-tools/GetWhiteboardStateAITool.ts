import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import { GetWhiteboardStateUseCase } from '@modules/whiteboards/application/use-cases/GetWhiteboardStateUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { text } from 'node:stream/consumers';
import { z } from 'zod';

interface ParsedWhiteboardScene {
    revision?: number;
    elements?: unknown[];
    appState?: Record<string, unknown>;
    files?: Record<string, unknown>;
}

@CollectionMember(AI_TOOL_TOKENS.AITool)
export class GetWhiteboardStateAITool extends AITool {
    readonly name = 'get_whiteboard_state';
    readonly description = 'Read the full Excalidraw scene of a whiteboard (elements, appState and files).';
    readonly parameters = z.object({ whiteboardId: z.string() });

    constructor(
        protected readonly useCase: GetWhiteboardStateUseCase
    ) {
        super();
    }

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const result = await this.useCase.execute({
            teamId: scope.teamId,
            whiteboardId: params.whiteboardId
        });
        if (!result.success) throw result.error;

        const raw = await text(result.value.stream);
        let scene: ParsedWhiteboardScene;
        try {
            scene = JSON.parse(raw) as ParsedWhiteboardScene;
        } catch {
            scene = { revision: 0, elements: [], appState: {} };
        }

        const elements = Array.isArray(scene.elements) ? scene.elements : [];
        const revision = typeof scene.revision === 'number' ? scene.revision : 0;

        return {
            summary: `Whiteboard scene has ${elements.length} element(s) at revision ${revision}.`,
            data: {
                revision,
                elements,
                appState: scene.appState ?? {},
                files: scene.files ?? {}
            }
        };
    }
}
