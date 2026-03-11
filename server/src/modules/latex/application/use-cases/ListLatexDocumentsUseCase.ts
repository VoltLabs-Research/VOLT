import { LATEX_TOKENS } from '@modules/latex/infrastructure/di/LatexTokens';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { inject, injectable } from 'tsyringe';
import type { ListLatexDocumentsInputDTO, ListLatexDocumentsOutputDTO } from '@modules/latex/application/dtos/ListLatexDocumentsDTO';
import type { IUseCase } from '@shared/application/IUseCase';
import type { ILatexDocumentRepository } from '@modules/latex/domain/port/ILatexDocumentRepository';

@injectable()
export class ListLatexDocumentsUseCase implements IUseCase<ListLatexDocumentsInputDTO, ListLatexDocumentsOutputDTO, ApplicationError> {
    constructor(
        @inject(LATEX_TOKENS.LatexDocumentRepository)
        private readonly latexDocumentRepository: ILatexDocumentRepository
    ) {}

    async execute(input: ListLatexDocumentsInputDTO): Promise<Result<ListLatexDocumentsOutputDTO, ApplicationError>> {
        const page = Math.max(1, Number(input.page || 1));
        const limit = Math.max(1, Math.min(500, Number(input.limit || 500)));

        let folderId: string | null | 'all';
        if (!input.folderId) {
            folderId = 'all';
        } else if (input.folderId === 'root') {
            folderId = null;
        } else {
            folderId = input.folderId;
        }

        const result = await this.latexDocumentRepository.findAllByTeam(input.teamId, {
            page,
            limit,
            search: input.search,
            folderId
        });

        const value: ListLatexDocumentsOutputDTO = {
            ...result,
            data: result.data.map((document) => ({
                _id: document._id,
                title: document.props.title,
                content: document.props.content,
                folder: document.props.folder,
                createdAt: document.props.createdAt,
                updatedAt: document.props.updatedAt
            }))
        };

        return Result.ok(value);
    }
};
