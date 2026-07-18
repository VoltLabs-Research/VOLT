import type { ILatexFileRepository } from '@modules/latex/domain/port/ILatexFileRepository';
import { LATEX_TOKENS } from '@modules/latex/infrastructure/di/LatexTokens';
import type { ILatexDocumentRepository } from '@modules/latex/domain/port/ILatexDocumentRepository';
import { ErrorCodes } from '@core/constants/error-codes';
import type { CreateLatexFileInputDTO, CreateLatexFileOutputDTO } from '@modules/latex/application/dtos/CreateLatexFileDTO';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IUseCase } from '@shared/application/IUseCase';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

/**
 * Creates a new LatexFile within a document.
 *
 * If `isEntrypoint` is true, the existing entrypoint is cleared atomically
 * before the new file is set as entrypoint.
 */
@Singleton()
export class CreateLatexFileUseCase implements IUseCase<CreateLatexFileInputDTO, CreateLatexFileOutputDTO> {
    constructor(
        @inject(LATEX_TOKENS.LatexDocumentRepository) private readonly latexDocumentRepository: ILatexDocumentRepository,
        @inject(LATEX_TOKENS.LatexFileRepository) private readonly latexFileRepository: ILatexFileRepository
    ) {}

    async execute(input: CreateLatexFileInputDTO): Promise<CreateLatexFileOutputDTO> {
        const document = await this.latexDocumentRepository.findByTeamAndDocumentId(
            input.teamId,
            input.documentId
        );

        if (!document) {
            throw ApplicationError.notFound(
                ErrorCodes.RESOURCE_NOT_FOUND,
                'LaTeX document not found'
            );
        }

        if (input.isEntrypoint) {
            await this.latexFileRepository.clearEntrypointForDocument(input.documentId);
        }

        const file = await this.latexFileRepository.create({
            document: input.documentId,
            team: input.teamId,
            name: input.name.trim(),
            path: input.path ?? '',
            content: input.content ?? '',
            isEntrypoint: input.isEntrypoint ?? false,
            createdBy: input.userId,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        return {
            _id: file._id,
            documentId: file.props.document,
            name: file.props.name,
            path: file.props.path,
            content: file.props.content,
            isEntrypoint: file.props.isEntrypoint,
            createdAt: file.props.createdAt,
            updatedAt: file.props.updatedAt
        };
    }
}
