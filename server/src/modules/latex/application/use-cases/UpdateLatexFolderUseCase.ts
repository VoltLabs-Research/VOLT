import { LATEX_TOKENS } from '@modules/latex/infrastructure/di/LatexTokens';
import { ErrorCodes } from '@core/constants/error-codes';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { inject, injectable } from 'tsyringe';
import type { IUseCase } from '@shared/application/IUseCase';
import type { ILatexFolderRepository } from '@modules/latex/domain/port/ILatexFolderRepository';
import type {
    UpdateLatexFolderInputDTO,
    UpdateLatexFolderOutputDTO
} from '@modules/latex/application/dtos/UpdateLatexFolderDTO';

@injectable()
export class UpdateLatexFolderUseCase implements IUseCase<UpdateLatexFolderInputDTO, UpdateLatexFolderOutputDTO, ApplicationError> {
    constructor(
        @inject(LATEX_TOKENS.LatexFolderRepository)
        private readonly latexFolderRepository: ILatexFolderRepository
    ) {}

    async execute(input: UpdateLatexFolderInputDTO): Promise<Result<UpdateLatexFolderOutputDTO, ApplicationError>> {
        try {
            const title = input.title?.trim();

            if (!title) {
                return Result.fail(ApplicationError.badRequest(
                    ErrorCodes.VALIDATION_INVALID_INPUT,
                    'Folder title is required'
                ));
            }

            const folder = await this.latexFolderRepository.findByTeamAndFolderId(
                input.teamId,
                input.folderId
            );

            if (!folder) {
                return Result.fail(ApplicationError.notFound(
                    ErrorCodes.RESOURCE_NOT_FOUND,
                    'LaTeX folder not found'
                ));
            }

            const updated = await this.latexFolderRepository.updateById(
                input.folderId,
                { title, updatedAt: new Date() }
            );

            const result = updated ?? folder;

            return Result.ok({
                _id: result._id,
                title: result.props.title,
                parent: result.props.parent,
                createdAt: result.props.createdAt,
                updatedAt: result.props.updatedAt
            });
        } catch (error) {
            if (error instanceof ApplicationError) {
                return Result.fail(error);
            }

            return Result.fail(new ApplicationError(
                ErrorCodes.INTERNAL_SERVER_ERROR,
                'Failed to update LaTeX folder',
                500
            ));
        }
    }
};
