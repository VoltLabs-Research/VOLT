import { injectable, inject } from 'tsyringe';
import { z } from 'zod';
import { AITool } from '@shared/application/ai/AITool';
import { ListLatexAssetsUseCase } from '@modules/latex/application/use-cases/ListLatexAssetsUseCase';
import type { AIToolScope } from '@modules/ai/infrastructure/services/AIToolService';
import type { LatexAssetDTO } from '@modules/latex/application/dtos/LatexAssetDTO';

@injectable()
export class ListLatexAssetsAITool extends AITool {
    readonly name = 'list_latex_assets';
    readonly description = 'List all assets (images, PDFs) in a LaTeX document.';
    readonly parameters = z.object({
        documentId: z.string()
    });

    constructor(
        @inject(ListLatexAssetsUseCase)
        protected readonly useCase: ListLatexAssetsUseCase
    ) {
        super();
    }

    async execute(params: z.infer<typeof this.parameters>, scope: AIToolScope) {
        const result = await this.useCase.execute({
            teamId: scope.teamId,
            documentId: params.documentId
        });
        if (!result.success) throw result.error;

        return {
            summary: `Found ${result.value.length} assets in the document.`,
            data: result.value.map((asset: LatexAssetDTO) => ({
                assetId: asset._id,
                originalName: asset.originalName,
                path: asset.path,
                mimetype: asset.mimetype,
                size: asset.size,
                createdAt: asset.createdAt
            }))
        };
    }
}
