import { LATEX_TOKENS } from '@modules/latex/infrastructure/di/LatexTokens';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { inject, injectable } from 'tsyringe';
import type { IUseCase } from '@shared/application/IUseCase';
import type { ILatexFolderRepository } from '@modules/latex/domain/port/ILatexFolderRepository';
import type {
    ListLatexFoldersInputDTO,
    ListLatexFoldersOutputDTO
} from '@modules/latex/application/dtos/ListLatexFoldersDTO';

@injectable()
export class ListLatexFoldersUseCase implements IUseCase<ListLatexFoldersInputDTO, ListLatexFoldersOutputDTO, ApplicationError> {
    constructor(
        @inject(LATEX_TOKENS.LatexFolderRepository)
        private readonly latexFolderRepository: ILatexFolderRepository
    ) {}

    async execute(input: ListLatexFoldersInputDTO): Promise<Result<ListLatexFoldersOutputDTO, ApplicationError>> {
        const page = Math.max(1, Number(input.page || 1));
        const limit = Math.max(1, Math.min(500, Number(input.limit || 500)));
        const parentId = input.parentId !== undefined ? input.parentId : null;

        const result = await this.latexFolderRepository.findAllByTeamAndParent(
            input.teamId,
            parentId,
            { page, limit }
        );

        const value: ListLatexFoldersOutputDTO = {
            ...result,
            data: result.data.map((folder) => ({
                _id: folder._id,
                title: folder.props.title,
                parent: folder.props.parent,
                createdAt: folder.props.createdAt,
                updatedAt: folder.props.updatedAt
            }))
        };

        return Result.ok(value);
    }
};
