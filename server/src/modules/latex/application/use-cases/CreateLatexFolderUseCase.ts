import { LATEX_TOKENS } from '@modules/latex/infrastructure/di/LatexTokens';
import { ErrorCodes } from '@core/constants/error-codes';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { inject, injectable } from 'tsyringe';
import type { IUseCase } from '@shared/application/IUseCase';
import type { ILatexFolderRepository } from '@modules/latex/domain/port/ILatexFolderRepository';
import type {
    CreateLatexFolderInputDTO,
    CreateLatexFolderOutputDTO
} from '@modules/latex/application/dtos/CreateLatexFolderDTO';

@injectable()
export class CreateLatexFolderUseCase implements IUseCase<CreateLatexFolderInputDTO, CreateLatexFolderOutputDTO, ApplicationError> {
    constructor(
        @inject(LATEX_TOKENS.LatexFolderRepository)
        private readonly latexFolderRepository: ILatexFolderRepository
    ) {}

    async execute(input: CreateLatexFolderInputDTO): Promise<Result<CreateLatexFolderOutputDTO, ApplicationError>> {
        try {
            const title = input.title?.trim();

            if (!title) {
                return Result.fail(ApplicationError.badRequest(
                    ErrorCodes.VALIDATION_INVALID_INPUT,
                    'Folder title is required'
                ));
            }

            const parentId = input.parentId ?? null;

            const folder = await this.latexFolderRepository.create({
                team: input.teamId,
                createdBy: input.userId,
                title,
                parent: parentId,
                createdAt: new Date(),
                updatedAt: new Date()
            });

            return Result.ok({
                _id: folder._id,
                title: folder.props.title,
                parent: folder.props.parent,
                createdAt: folder.props.createdAt,
                updatedAt: folder.props.updatedAt
            });
        } catch (error) {
            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }

            return Result.fail(new ApplicationError(
                ErrorCodes.INTERNAL_SERVER_ERROR,
                'Failed to create LaTeX folder',
                500
            ));
        }
    }
};
