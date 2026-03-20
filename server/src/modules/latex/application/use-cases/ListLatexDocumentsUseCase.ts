import { USER_POPULATE, LAST_EDITED_BY_POPULATE } from '@shared/application/PopulatePresets';
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
        const parsedPage = Number(input.page);
        const parsedLimit = Number(input.limit);
        const page = Number.isFinite(parsedPage) ? Math.max(1, parsedPage) : 1;
        const limit = Number.isFinite(parsedLimit) ? Math.max(1, Math.min(500, parsedLimit)) : 500;

        let folderId: string | null | 'all';
        if (!input.folderId) {
            folderId = 'all';
        } else if (input.folderId === 'root') {
            folderId = null;
        } else {
            folderId = input.folderId;
        }

        const filter: Record<string, unknown> = { team: input.teamId };
        if (input.search) {
            filter.title = { $regex: input.search, $options: 'i' };
        }
        if (folderId !== 'all') {
            filter.folder = folderId;
        }

        const result = await this.latexDocumentRepository.findAll({
            filter,
            page,
            limit,
            sort: { updatedAt: -1 },
            populate: [
                USER_POPULATE,
                LAST_EDITED_BY_POPULATE
            ]
        });

        const value: ListLatexDocumentsOutputDTO = {
            ...result,
            data: result.data.map((document) => ({
                _id: document._id,
                title: document.props.title,
                folder: document.props.folder,
                createdBy: document.props.createdBy,
                lastEditedBy: document.props.lastEditedBy,
                createdAt: document.props.createdAt,
                updatedAt: document.props.updatedAt
            }))
        };

        return Result.ok(value);
    }
};
