import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import { ListLatexAssetsUseCase } from '@modules/latex/application/use-cases/ListLatexAssetsUseCase';
import { ExportLatexDocumentTexUseCase } from '@modules/latex/application/use-cases/ExportLatexDocumentTexUseCase';
import { ExportLatexDocumentZipUseCase } from '@modules/latex/application/use-cases/ExportLatexDocumentZipUseCase';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

@CollectionMember(AI_TOOL_TOKENS.AITool)
export class ManageLatexAssetsAITool extends AITool {
    readonly name = 'manage_latex_assets';
    readonly description = "List the binary assets attached to a LaTeX document, or export the whole document as a downloadable file ('tex' for the entrypoint .tex, 'zip' for the full project including assets).";
    readonly parameters = z.object({
        documentId: z.string(),
        action: z.enum(['list', 'export']),
        format: z.enum(['tex', 'zip']).optional()
    });

    constructor(
        protected readonly listAssetsUseCase: ListLatexAssetsUseCase,
        protected readonly exportTexUseCase: ExportLatexDocumentTexUseCase,
        protected readonly exportZipUseCase: ExportLatexDocumentZipUseCase
    ) {
        super();
    }

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        if (params.action === 'list') {
            const result = await this.listAssetsUseCase.execute({
                teamId: scope.teamId,
                documentId: params.documentId
            });
            if (!result.success) throw result.error;
            return {
                summary: `Found ${result.value.length} LaTeX assets.`,
                data: result.value
            };
        }

        const format = params.format ?? 'zip';
        const useCase = format === 'tex' ? this.exportTexUseCase : this.exportZipUseCase;

        const result = await useCase.execute({
            teamId: scope.teamId,
            documentId: params.documentId
        });
        if (!result.success) throw result.error;

        if (result.value.prepare) {
            await result.value.prepare();
        }

        const headers = result.value.headers;
        const disposition = headers['Content-Disposition'] ?? '';
        const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? `document.${format}`;

        return {
            summary: `Exported LaTeX document as "${filename}" (${format}).`,
            data: {
                format,
                filename,
                contentType: headers['Content-Type'],
                headers
            }
        };
    }
}
