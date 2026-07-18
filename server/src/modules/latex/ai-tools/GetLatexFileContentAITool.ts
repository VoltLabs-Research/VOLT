import type { AIToolScope } from '@shared/contracts/types/AiToolScope';
import LatexService from '@modules/latex/services/LatexService';
import { AITool } from '@shared/application/ai/AITool';
import { z } from 'zod';

const parameters = z.object({
    documentId: z.string(),
    fileId: z.string()
});
type Params = z.infer<typeof parameters>;

export class GetLatexFileContentAITool extends AITool<Params> {
    readonly name = 'get_latex_file_content';
    readonly description = "Read the full source content of a single file (e.g. a .tex file) inside a LaTeX document.";
    readonly parameters = parameters;

    #service = new LatexService();

    async execute(params: Params, scope: AIToolScope) {
        const files = await this.#service.listFiles({ teamId: scope.teamId, documentId: params.documentId });
        const file = files.find((candidate) => candidate._id === params.fileId);
        if (!file) {
            throw new Error(`LaTeX file ${params.fileId} was not found in document ${params.documentId}.`);
        }
        return {
            summary: `Read ${file.content.length} characters from LaTeX file "${file.path}${file.name}".`,
            data: file
        };
    }
}
