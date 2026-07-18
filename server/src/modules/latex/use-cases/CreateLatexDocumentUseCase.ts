import { CLUSTER_ACCESS_TOKENS } from '@shared/contracts/tokens/ClusterAccessTokens';
import type { ILatexFolderRepository } from '@modules/latex/ports/ILatexFolderRepository';
import { LATEX_TOKENS } from '@modules/latex/di/LatexTokens';
import type { ILatexDocumentRepository } from '@modules/latex/ports/ILatexDocumentRepository';
import { ErrorCodes } from '@core/constants/error-codes';
import type { ITeamClusterSelectionService } from '@shared/contracts/ports';
import type { CreateLatexDocumentInputDTO, CreateLatexDocumentOutputDTO } from '@modules/latex/dtos/CreateLatexDocumentDTO';
import LatexDocumentCreatedEvent from '@modules/latex/events/LatexDocumentCreatedEvent';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IEventBus } from '@shared/application/events/IEventBus';
import type { IUseCase } from '@shared/application/IUseCase';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { inject } from 'tsyringe';

@Singleton()
export class CreateLatexDocumentUseCase implements IUseCase<CreateLatexDocumentInputDTO, CreateLatexDocumentOutputDTO> {
    constructor(
        @inject(LATEX_TOKENS.LatexDocumentRepository) private readonly latexDocumentRepository: ILatexDocumentRepository,
        @inject(LATEX_TOKENS.LatexFolderRepository) private readonly latexFolderRepository: ILatexFolderRepository,
        @inject(CLUSTER_ACCESS_TOKENS.TeamClusterSelectionService) private readonly teamClusterSelectionService: ITeamClusterSelectionService,
        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus
    ) {}

    async execute(input: CreateLatexDocumentInputDTO): Promise<CreateLatexDocumentOutputDTO> {
        const title = input.title?.trim();

        if (!title) {
            throw ApplicationError.badRequest(
                ErrorCodes.VALIDATION_INVALID_INPUT,
                'Document title is required'
            );
        }

        if (input.folderId) {
            const folder = await this.latexFolderRepository.findByTeamAndFolderId(
                input.teamId,
                input.folderId
            );

            if (!folder) {
                throw ApplicationError.notFound(
                    ErrorCodes.RESOURCE_NOT_FOUND,
                    'Target LaTeX folder not found'
                );
            }
        }

        const storageClusterId = await this.teamClusterSelectionService.resolveStorageClusterId(input.teamId);

        const document = await this.latexDocumentRepository.create({
            team: input.teamId,
            title,
            storageClusterId,
            createdBy: input.userId,
            lastEditedBy: input.userId,
            folder: input.folderId ?? null,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        await this.eventBus.publish(new LatexDocumentCreatedEvent({
            documentId: document._id,
            teamId: input.teamId,
            userId: input.userId,
            documentTitle: document.props.title ?? ''
        }));

        return {
            _id: document._id,
            title: document.props.title,
            folder: document.props.folder,
            createdBy: document.props.createdBy,
            lastEditedBy: document.props.lastEditedBy,
            createdAt: document.props.createdAt,
            updatedAt: document.props.updatedAt
        };
    }
}
