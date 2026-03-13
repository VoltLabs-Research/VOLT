import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';
import { injectable, inject } from 'tsyringe';
import { z } from 'zod';
import { AITool } from '@shared/application/ai/AITool';
import { UpdateLatexFileUseCase } from '@modules/latex/application/use-cases/UpdateLatexFileUseCase';
import type { AIToolScope } from '@modules/ai/infrastructure/services/AIToolService';
import type { ISocketEmitter } from '@modules/socket/domain/port/ISocketEmitter';

@injectable()
export class EditLatexFileAITool extends AITool {
    readonly name = 'edit_latex_file';
    readonly description = 'Edit/update an existing LaTeX file\'s content.';
    readonly parameters = z.object({
        documentId: z.string(),
        fileId: z.string(),
        content: z.string()
    });

    constructor(
        @inject(UpdateLatexFileUseCase)
        protected readonly useCase: UpdateLatexFileUseCase,

        @inject(SOCKET_TOKENS.SocketEmitter)
        private readonly socketEmitter: ISocketEmitter
    ) {
        super();
    }

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const result = await this.useCase.execute({
            teamId: scope.teamId,
            documentId: params.documentId,
            fileId: params.fileId,
            content: params.content
        });
        if (!result.success) throw result.error;

        this.socketEmitter.emitToRoom(
            `latex-doc-${params.documentId}`,
            'latex_content_updated',
            {
                documentId: params.documentId,
                fileId: params.fileId,
                content: params.content,
                timestamp: Date.now(),
                senderId: 'ai-assistant'
            }
        );

        return {
            summary: `Updated file "${result.value.name}".`,
            fileId: result.value._id,
            name: result.value.name,
            path: result.value.path,
            updatedAt: result.value.updatedAt
        };
    }
}
