import { SOCKET_TOKENS } from '@modules/socket/infrastructure/di/SocketTokens';
import { injectable, inject } from 'tsyringe';
import { z } from 'zod';
import { AITool } from '@shared/application/ai/AITool';
import { CreateLatexFileUseCase } from '@modules/latex/application/use-cases/CreateLatexFileUseCase';
import type { AIToolScope } from '@modules/ai/infrastructure/services/AIToolService';
import type { ISocketEmitter } from '@modules/socket/domain/port/ISocketEmitter';

@injectable()
export class CreateLatexFileAITool extends AITool {
    readonly name = 'create_latex_file';
    readonly description = 'Create a new file in a LaTeX document.';
    readonly parameters = z.object({
        documentId: z.string(),
        filename: z.string(),
        content: z.string().optional().default('')
    });

    constructor(
        @inject(CreateLatexFileUseCase)
        protected readonly useCase: CreateLatexFileUseCase,

        @inject(SOCKET_TOKENS.SocketEmitter)
        private readonly socketEmitter: ISocketEmitter
    ) {
        super();
    }

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const result = await this.useCase.execute({
            teamId: scope.teamId,
            documentId: params.documentId,
            userId: scope.userId,
            name: params.filename,
            content: params.content
        });
        if (!result.success) throw result.error;

        this.socketEmitter.emitToRoom(
            `latex-doc-${params.documentId}`,
            'latex_content_updated',
            {
                documentId: params.documentId,
                fileId: result.value._id,
                content: params.content,
                timestamp: Date.now(),
                senderId: 'ai-assistant'
            }
        );

        return {
            summary: `Created file "${result.value.name}".`,
            fileId: result.value._id,
            name: result.value.name,
            path: result.value.path,
            isEntrypoint: result.value.isEntrypoint,
            createdAt: result.value.createdAt
        };
    }
}
