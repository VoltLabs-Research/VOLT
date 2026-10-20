import { requireTeamMembership } from '@modules/team/services/team/team-membership-guard';
import secretKeyService from '@modules/team/services/SecretKeyService';
import ScriptingNotebook from '@modules/scripting/models/ScriptingNotebook';
import { encrypt, decrypt } from '@shared/utilities/crypto';
import logger from '@shared/logger';

class NotebookCredentialService {
    async resolveSecretKey(notebook: ScriptingNotebook, userId: string): Promise<string> {
        if (notebook.secretKeyId && notebook.secretKeyEncrypted) {
            return decrypt(notebook.secretKeyEncrypted);
        }

        const teamId = notebook.team;
        const roleId = await this.resolveLauncherRoleId(teamId, userId);

        const { secretKeyId, secretKey } = await secretKeyService.create(teamId, userId, {
            roleId,
            name: `notebook:${notebook.id}`
        });
        await ScriptingNotebook.update(
            { id: notebook.id },
            {
                secretKeyId,
                secretKeyEncrypted: await encrypt(secretKey)
            }
        );

        return secretKey;
    }

    async revokeSecretKey(notebook: ScriptingNotebook): Promise<void> {
        const secretKeyId = notebook.secretKeyId;
        if (!secretKeyId) {
            return;
        }

        try {
            await secretKeyService.deleteById(
                notebook.team,
                secretKeyId,
                notebook.createdBy
            );
        } catch (err) {
            logger.warn(
                {
                    secretKeyId,
                    notebookId: notebook.id,
                    err
                },
                '[Scripting] Failed to revoke notebook secret key'
            );
        }
    }

    private async resolveLauncherRoleId(teamId: string, userId: string): Promise<string> {
        const member = await requireTeamMembership(teamId, userId);
        return member.role;
    }
}

export default new NotebookCredentialService();
