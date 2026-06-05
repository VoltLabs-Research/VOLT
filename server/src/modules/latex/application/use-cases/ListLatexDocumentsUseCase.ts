import { LATEX_TOKENS } from '@modules/latex/infrastructure/di/LatexTokens';
import type { ILatexDocumentRepository } from '@modules/latex/domain/port/ILatexDocumentRepository';
import type { ListLatexDocumentsInputDTO, ListLatexDocumentsOutputDTO } from '@modules/latex/application/dtos/ListLatexDocumentsDTO';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { LAST_EDITED_BY_POPULATE, USER_POPULATE } from '@shared/application/PopulatePresets';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

@Singleton()
export class ListLatexDocumentsUseCase implements IUseCase<ListLatexDocumentsInputDTO, ListLatexDocumentsOutputDTO, ApplicationError> {
    constructor(
        @inject(LATEX_TOKENS.LatexDocumentRepository) private readonly latexDocumentRepository: ILatexDocumentRepository
    ) {}

    async execute(input: ListLatexDocumentsInputDTO): Promise<Result<ListLatexDocumentsOutputDTO, ApplicationError>> {
        const page = Math.max(1, input.page ?? 1);
        const limit = Math.max(1, Math.min(500, input.limit ?? 500));

        const filter: Record<string, unknown> = { team: input.teamId };
        if (input.search) {
            filter.title = { $regex: input.search, $options: 'i' };
        }
        if (input.folderId) {
            filter.folder = input.folderId === 'root' ? null : input.folderId;
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
}
