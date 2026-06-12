import { TEAM_CONTRACT_TOKENS } from '@shared/contracts/tokens/TeamTokens';
import type { ITeamMemberRepository } from '@modules/team/domain/port/team-member/ITeamMemberRepository';
import { isPopulatedTeamMemberRole } from '@modules/team/domain/entities/team-member/TeamMember';
import CreateSecretKeyUseCase from '@modules/team/application/use-cases/secret-key/CreateSecretKeyUseCase';
import DeleteSecretKeyByIdUseCase from '@modules/team/application/use-cases/secret-key/DeleteSecretKeyByIdUseCase';
import type ScriptingNotebook from '@modules/scripting/domain/entities/ScriptingNotebook';
import { SCRIPTING_TOKENS } from '@modules/scripting/infrastructure/di/ScriptingTokens';
import type { IScriptingNotebookRepository } from '@modules/scripting/domain/port/IScriptingNotebookRepository';
import type { INotebookCredentialService } from '@modules/scripting/domain/port/INotebookCredentialService';
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
 */
@Singleton(SCRIPTING_TOKENS.NotebookCredentialService)
export class NotebookCredentialService implements INotebookCredentialService {
    constructor(
        @inject(SCRIPTING_TOKENS.ScriptingNotebookRepository) private readonly scriptingNotebookRepository: IScriptingNotebookRepository,
        @inject(TEAM_CONTRACT_TOKENS.TeamMemberRepository) private readonly teamMemberRepository: ITeamMemberRepository,
        private readonly createSecretKeyUseCase: CreateSecretKeyUseCase,
        private readonly deleteSecretKeyByIdUseCase: DeleteSecretKeyByIdUseCase
    ) {}

    /**
     * Returns the raw `vsk_` secret key for a notebook, creating and persisting
     * it (encrypted) on first use and decrypting the stored one thereafter.
     */
    async resolveSecretKey(notebook: ScriptingNotebook, userId: string): Promise<string> {
        if (notebook.props.secretKeyId && notebook.props.secretKeyEncrypted) {
            return decrypt(notebook.props.secretKeyEncrypted);
        }

        const roleId = await this.resolveLauncherRoleId(notebook.props.team, userId);

        const result = await this.createSecretKeyUseCase.execute({
            teamId: notebook.props.team,
            roleId,
            name: `notebook:${notebook._id}`,
            userId
        });

        if (!result.success) {
            throw result.error;
        }

        const { secretKeyId, secretKey } = result.value;
        await this.scriptingNotebookRepository.updateById(notebook._id, {
            secretKeyId,
            secretKeyEncrypted: await encrypt(secretKey)
        });

        return secretKey;
    }

    /**
     * Deletes the notebook's `vsk_` credential. Safe to call when no key exists.
     */
    async revokeSecretKey(notebook: ScriptingNotebook): Promise<void> {
        const { secretKeyId, team, createdBy } = notebook.props;
        if (!secretKeyId) {
            return;
        }

        const result = await this.deleteSecretKeyByIdUseCase.execute({
            secretKeyId,
            teamId: team,
            userId: createdBy
        });

        if (!result.success) {
            logger.warn(
                { secretKeyId, notebookId: notebook._id, err: result.error },
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
