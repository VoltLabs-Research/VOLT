import { TEAM_CONTRACT_TOKENS } from '@shared/contracts/tokens/TeamTokens';
import type { ITeamMemberRepository } from '@modules/team/ports/team-member/ITeamMemberRepository';
import { isPopulatedTeamMemberRole } from '@modules/team/entities/team-member/TeamMember';
import CreateSecretKeyUseCase from '@modules/team/use-cases/secret-key/CreateSecretKeyUseCase';
import DeleteSecretKeyByIdUseCase from '@modules/team/use-cases/secret-key/DeleteSecretKeyByIdUseCase';
import ScriptingNotebookModel from '@modules/scripting/models/ScriptingNotebookModel';
import type { ScriptingNotebookDocument } from '@modules/scripting/models/ScriptingNotebookModel';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { ErrorCodes } from '@core/constants/error-codes';
import { encrypt, decrypt } from '@shared/infrastructure/utilities/crypto';
import { Singleton } from '@shared/infrastructure/di/decorators';
import logger from '@shared/infrastructure/logger';
import { inject } from 'tsyringe';

/**
 * Owns the per-notebook `vsk_` credential that the in-app Jupyter container uses
 * to call VOLT back as the launching user. The key is minted once (with the
 * launcher's team role), stored encrypted on the notebook so it can be
 * re-injected on every session, and deleted when the notebook is destroyed.
 * Talks to the Mongoose {@link ScriptingNotebookModel} directly (no repository);
 * operates on the notebook document handed in by {@link ScriptingService} / the
 * trajectory-deleted handler.
 */
@Singleton()
export class NotebookCredentialService {
    constructor(
        @inject(TEAM_CONTRACT_TOKENS.TeamMemberRepository) private readonly teamMemberRepository: ITeamMemberRepository,
        private readonly createSecretKeyUseCase: CreateSecretKeyUseCase,
        private readonly deleteSecretKeyByIdUseCase: DeleteSecretKeyByIdUseCase
    ) {}

    /**
     * Returns the raw `vsk_` secret key for a notebook, creating and persisting
     * it (encrypted) on first use and decrypting the stored one thereafter.
     */
    async resolveSecretKey(notebook: ScriptingNotebookDocument, userId: string): Promise<string> {
        if (notebook.secretKeyId && notebook.secretKeyEncrypted) {
            return decrypt(notebook.secretKeyEncrypted);
        }

        const teamId = String(notebook.team);
        const roleId = await this.resolveLauncherRoleId(teamId, userId);

        const { secretKeyId, secretKey } = await this.createSecretKeyUseCase.execute({
            teamId,
            roleId,
            name: `notebook:${String(notebook._id)}`,
            userId
        });
        await ScriptingNotebookModel.updateOne(
            { _id: notebook._id },
            { $set: { secretKeyId, secretKeyEncrypted: await encrypt(secretKey) } }
        );

        return secretKey;
    }

    /**
     * Deletes the notebook's `vsk_` credential. Safe to call when no key exists.
     */
    async revokeSecretKey(notebook: ScriptingNotebookDocument): Promise<void> {
        const secretKeyId = notebook.secretKeyId;
        if (!secretKeyId) {
            return;
        }

        try {
            await this.deleteSecretKeyByIdUseCase.execute({
                secretKeyId,
                teamId: String(notebook.team),
                userId: String(notebook.createdBy)
            });
        } catch (err) {
            logger.warn(
                { secretKeyId, notebookId: String(notebook._id), err },
                '[Scripting] Failed to revoke notebook secret key'
            );
        }
    }

    private async resolveLauncherRoleId(teamId: string, userId: string): Promise<string> {
        const member = await this.teamMemberRepository.findOne(
            { user: userId, team: teamId },
            { populate: { path: 'role', select: ['name', 'permissions'] } }
        );

        if (!member) {
            throw ApplicationError.notFound(
                ErrorCodes.TEAM_MEMBER_NOT_FOUND,
                'Team membership not found for notebook credential'
            );
        }

        const { role } = member.props;
        return isPopulatedTeamMemberRole(role) ? role._id : role;
    }
}
