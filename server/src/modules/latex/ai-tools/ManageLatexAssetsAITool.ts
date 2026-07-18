import { AI_TOOL_TOKENS } from '@shared/contracts/tokens/AiToolTokens';
import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import LatexService from '@modules/latex/services/LatexService';
import { AITool } from '@shared/application/ai/AITool';
import { CollectionMember } from '@shared/infrastructure/di/decorators';
import { z } from 'zod';

const parameters = z.object({
    documentId: z.string(),
    action: z.enum(['list', 'export']),
    format: z.enum(['tex', 'zip']).optional()
});
type Params = z.infer<typeof parameters>;

@CollectionMember(AI_TOOL_TOKENS.AITool)
export class ManageLatexAssetsAITool extends AITool<Params> {
    readonly name = 'manage_latex_assets';
    readonly description = "List the binary assets attached to a LaTeX document, or export the whole document as a downloadable file ('tex' for the entrypoint .tex, 'zip' for the full project including assets).";
    readonly parameters = parameters;

    #service = new LatexService();

    async execute(params: Params, scope: AIToolScope) {
        if (params.action === 'list') {
            const result = await this.#service.listAssets({ teamId: scope.teamId, documentId: params.documentId });
            return { summary: `Found ${result.length} LaTeX assets.`, data: result };
        }

        const format = params.format ?? 'zip';
        const result = format === 'tex'
            ? await this.#service.exportDocumentTex({ teamId: scope.teamId, documentId: params.documentId })
            : await this.#service.exportDocumentZip({ teamId: scope.teamId, documentId: params.documentId });

        if (result.prepare) {
            await result.prepare();
        }

        const headers = result.headers;
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
