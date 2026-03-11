import { ErrorCodes } from '@core/constants/error-codes';
import { LATEX_TOKENS } from '@modules/latex/infrastructure/di/LatexTokens';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { Result } from '@shared/domain/port/Result';
import { inject, injectable } from 'tsyringe';
import type { IUseCase } from '@shared/application/IUseCase';
import type { ILatexFolderRepository } from '@modules/latex/domain/port/ILatexFolderRepository';
import type {
    GetLatexFolderInputDTO,
    GetLatexFolderOutputDTO
} from '@modules/latex/application/dtos/GetLatexFolderDTO';

@injectable()
export class GetLatexFolderUseCase implements IUseCase<GetLatexFolderInputDTO, GetLatexFolderOutputDTO, ApplicationError> {
    constructor(
        @inject(LATEX_TOKENS.LatexFolderRepository)
        private readonly latexFolderRepository: ILatexFolderRepository
    ) {}

    async execute(input: GetLatexFolderInputDTO): Promise<Result<GetLatexFolderOutputDTO, ApplicationError>> {
        try {
            const folder = await this.latexFolderRepository.findByTeamAndFolderId(input.teamId, input.folderId);

            if (!folder) {
                return Result.fail(ApplicationError.notFound(
                    ErrorCodes.RESOURCE_NOT_FOUND,
                    'LaTeX folder not found'
                ));
            }

            return Result.ok({
                _id: folder._id,
                title: folder.props.title,
                parent: folder.props.parent,
                createdAt: folder.props.createdAt,
                updatedAt: folder.props.updatedAt
            });
        } catch {
            return Result.fail(new ApplicationError(
                ErrorCodes.INTERNAL_SERVER_ERROR,
                'Failed to fetch LaTeX folder',
                500
            ));
        }
    }
};
