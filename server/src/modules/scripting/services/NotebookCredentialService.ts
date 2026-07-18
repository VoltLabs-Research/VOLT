import TeamMemberModel, { isPopulatedTeamMemberRole } from '@modules/team/models/team-member/TeamMemberModel';
import SecretKeyService from '@modules/team/services/SecretKeyService';
import ScriptingNotebookModel from '@modules/scripting/models/ScriptingNotebookModel';
import type { ScriptingNotebookDocument } from '@modules/scripting/models/ScriptingNotebookModel';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { ErrorCodes } from '@core/constants/error-codes';
import { encrypt, decrypt } from '@shared/infrastructure/utilities/crypto';
import logger from '@shared/infrastructure/logger';

export class NotebookCredentialService {
    readonly #secretKeys = new SecretKeyService();

    async resolveSecretKey(notebook: ScriptingNotebookDocument, userId: string): Promise<string> {
        if (notebook.secretKeyId && notebook.secretKeyEncrypted) {
            return decrypt(notebook.secretKeyEncrypted);
        }

        const teamId = String(notebook.team);
        const roleId = await this.resolveLauncherRoleId(teamId, userId);

        const { secretKeyId, secretKey } = await this.#secretKeys.create(teamId, userId, {
            roleId,
            name: `notebook:${String(notebook._id)}`
        });
        await ScriptingNotebookModel.updateOne(
            { _id: notebook._id },
            { $set: { secretKeyId, secretKeyEncrypted: await encrypt(secretKey) } }
        );

        return secretKey;
    }

    async revokeSecretKey(notebook: ScriptingNotebookDocument): Promise<void> {
        const secretKeyId = notebook.secretKeyId;
        if (!secretKeyId) {
            return;
        }

        try {
            await this.#secretKeys.deleteById(
                String(notebook.team),
                secretKeyId,
                String(notebook.createdBy)
            );
        } catch (err) {
            logger.warn(
                { secretKeyId, notebookId: String(notebook._id), err },
                '[Scripting] Failed to revoke notebook secret key'
            );
        }
    }

    private async resolveLauncherRoleId(teamId: string, userId: string): Promise<string> {
        const member = await TeamMemberModel.findOne(
            { user: userId, team: teamId }
        ).populate({ path: 'role', select: ['name', 'permissions'] });

        if (!member) {
            throw ApplicationError.notFound(
                ErrorCodes.TEAM_MEMBER_NOT_FOUND,
                'Team membership not found for notebook credential'
            );
        }

        const { role } = member;
        return isPopulatedTeamMemberRole(role) ? role._id : String(role);
    }
}

export default new NotebookCredentialService();
