import AIToolController from '@shared/ai/AIToolController';
import { AITool, ClientAITool } from '@shared/ai/tool';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import WhiteboardService from '@modules/whiteboards/services/WhiteboardService';
import { text } from 'node:stream/consumers';
import {
    createWhiteboardSchema,
    deleteWhiteboardFolderSchema,
    drawOnWhiteboardSchema,
    listWhiteboardsSchema,
    moveWhiteboardSchema,
    updateWhiteboardSchema,
    whiteboardRefSchema,
    type CreateWhiteboardInput,
    type DeleteWhiteboardFolderInput,
    type ListWhiteboardsInput,
    type MoveWhiteboardInput,
    type UpdateWhiteboardInput,
    type WhiteboardRefInput
} from '@volt/contracts/modules/whiteboards/ai-tools';

interface ParsedWhiteboardScene {
    revision?: number;
    elements?: unknown[];
    appState?: Record<string, unknown>;
    files?: Record<string, unknown>;
}

export default class WhiteboardAIToolController extends AIToolController {
    #service = new WhiteboardService();

    @AITool({
        name: 'create_whiteboard',
        description: 'Create a new whiteboard.',
        parameters: createWhiteboardSchema
    })
    createWhiteboard(input: CreateWhiteboardInput & AIToolScope) {
        return this.#service.createWhiteboard(input.teamId, input.userId, input);
    }

    @AITool({
        name: 'list_whiteboards',
        description: 'List all whiteboards in the team.',
        parameters: listWhiteboardsSchema
    })
    async listWhiteboards(input: ListWhiteboardsInput & AIToolScope) {
        const { total, data } = await this.#service.listWhiteboards(input.teamId, input);
        return { summary: `Found ${total} whiteboards.`, data };
    }

    @AITool({
        name: 'get_whiteboard',
        description: 'Get detailed information about a specific whiteboard.',
        parameters: whiteboardRefSchema
    })
    async getWhiteboard(input: WhiteboardRefInput & AIToolScope) {
        const whiteboard = await this.#service.getWhiteboard(input.teamId, input.whiteboardId);
        return { summary: `Retrieved whiteboard ${input.whiteboardId}.`, data: whiteboard };
    }

    @AITool({
        name: 'get_whiteboard_state',
        description: 'Read the full Excalidraw scene of a whiteboard (elements, appState and files).',
        parameters: whiteboardRefSchema
    })
    async getWhiteboardState(input: WhiteboardRefInput & AIToolScope) {
        const { stream } = await this.#service.getWhiteboardState(input.teamId, input.whiteboardId);
        const raw = await text(stream);

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

    @AITool({
        name: 'update_whiteboard',
        description: 'Update a whiteboard.',
        parameters: updateWhiteboardSchema
    })
    updateWhiteboard(input: UpdateWhiteboardInput & AIToolScope) {
        return this.#service.updateWhiteboard(input.teamId, input.whiteboardId, input.userId, input);
    }

    @AITool({
        name: 'move_whiteboard',
        description: 'Move a whiteboard to a different folder.',
        parameters: moveWhiteboardSchema
    })
    async moveWhiteboard(input: MoveWhiteboardInput & AIToolScope) {
        await this.#service.moveWhiteboard(input.teamId, input.whiteboardId, input.folderId);
        return { summary: `Moved whiteboard ${input.whiteboardId}.`, data: null };
    }

    @AITool({
        name: 'delete_whiteboard',
        description: 'Delete a whiteboard.',
        parameters: whiteboardRefSchema
    })
    async deleteWhiteboard(input: WhiteboardRefInput & AIToolScope) {
        await this.#service.deleteWhiteboard(input.teamId, input.whiteboardId, input.userId);
        return { summary: `Deleted whiteboard ${input.whiteboardId}.`, data: null };
    }

    @AITool({
        name: 'delete_whiteboard_folder',
        description: 'Delete a whiteboard folder.',
        parameters: deleteWhiteboardFolderSchema
    })
    async deleteWhiteboardFolder(input: DeleteWhiteboardFolderInput & AIToolScope) {
        await this.#service.deleteFolder(input.teamId, input.folderId, input.userId);
        return { summary: `Deleted whiteboard folder ${input.folderId}.`, data: null };
    }

    @ClientAITool({
        name: 'draw_on_whiteboard',
        description: 'Draw actual content (boxes, text, arrows, lines, ellipses, diamonds) onto a '
            + 'whiteboard so the user sees the diagram appear live. Provide a list of high-level elements; '
            + 'connect shapes by giving them ids and binding arrows with start/end. Use this to build '
            + 'flowcharts, pipelines, mind maps and sketches — do not just create an empty board. '
            + 'Resolve the whiteboardId with create_whiteboard / list_whiteboards first.',
        parameters: drawOnWhiteboardSchema
    })
    drawOnWhiteboard(): void {}
}
