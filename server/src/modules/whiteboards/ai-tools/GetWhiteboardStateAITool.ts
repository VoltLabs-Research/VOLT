import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import WhiteboardService from '@modules/whiteboards/services/WhiteboardService';
import { AITool } from '@shared/application/ai/AITool';
import { text } from 'node:stream/consumers';
import { z } from 'zod';

interface ParsedWhiteboardScene {
    revision?: number;
    elements?: unknown[];
    appState?: Record<string, unknown>;
    files?: Record<string, unknown>;
}

export class GetWhiteboardStateAITool extends AITool {
    readonly name = 'get_whiteboard_state';
    readonly description = 'Read the full Excalidraw scene of a whiteboard (elements, appState and files).';
    readonly parameters = z.object({ whiteboardId: z.string() });

    #service = new WhiteboardService();

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const value = await this.#service.getWhiteboardState(scope.teamId, params.whiteboardId);

        const raw = await text(value.stream);
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
