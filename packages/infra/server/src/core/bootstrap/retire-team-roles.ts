import type { DataSource, QueryRunner } from 'typeorm';
import { TEAM_ROLES, TeamRole } from '@volt/contracts/modules/team/access';
import logger from '@shared/logger';

// Until November 2026 a team's roles were editable rows of team_roles, and team_members,
// secret_keys and team_invitations pointed at one through their role column. Roles are fixed now
// and that column holds the role key. This rewrites each reference into its key while team_roles
// still exists, before synchronize runs, so it must not need the foreign keys synchronize drops.
// It does nothing once team_roles is gone.

const LEGACY_TABLE = 'team_roles';
const REFERRING_TABLES = ['team_members', 'secret_keys', 'team_invitations'];

const crud = (resource: string): string[] => ['read', 'create', 'update', 'delete'].map((action) => `${resource}:${action}`);

// The permissions the fixed roles had, frozen, to place custom roles.
const LEGACY_PERMISSIONS: readonly [TeamRole, readonly string[]][] = [
    [TeamRole.Admin, [
        'trajectory', 'analysis', 'plugin', 'scripting', 'daily-activity', 'team-invitation',
        'team-member', 'team-role', 'simulation-cell', 'ai-conversation', 'whiteboard'
    ].flatMap(crud)],
    [TeamRole.Member, [
        'team:read', ...crud('trajectory'), ...crud('analysis'), 'plugin:read', 'plugin:create',
        ...crud('scripting'), 'daily-activity:read', 'simulation-cell:read', ...crud('ai-conversation'),
        ...crud('whiteboard')
    ]],
    [TeamRole.Viewer, [
        'trajectory:read', 'analysis:read', 'plugin:read', 'scripting:read', 'daily-activity:read',
        'simulation-cell:read', 'whiteboard:read'
    ]]
];

const SYSTEM_ROLE_KEYS: Readonly<Record<string, TeamRole>> = {
    Owner: TeamRole.Owner,
    Admin: TeamRole.Admin,
    Member: TeamRole.Member,
    Viewer: TeamRole.Viewer
};

interface LegacyRoleRow{
    id: string;
    name: string;
    permissions: string | null;
    isSystem: boolean | number;
}

// A system role keeps its name. A custom role becomes the highest fixed role whose permissions it
// held in full, so nobody gains access; one that held less than a Viewer becomes a Viewer.
const keyOf = (row: LegacyRoleRow): TeamRole => {
    const systemKey = SYSTEM_ROLE_KEYS[row.name];
    if (Boolean(row.isSystem) && systemKey) return systemKey;

    const held = new Set((row.permissions ?? '').split(',').filter(Boolean));
    if (held.has('*')) return TeamRole.Owner;

    const fitting = LEGACY_PERMISSIONS.find(([, permissions]) => permissions.every((permission) => held.has(permission)));
    return fitting?.[0] ?? TeamRole.Viewer;
};

const placeholders = (runner: QueryRunner, count: number, offset = 0): string[] =>
    Array.from({ length: count }, (_, index) => runner.connection.options.type === 'postgres' ? `$${offset + index + 1}` : '?');

const rewriteReferences = async (runner: QueryRunner, table: string, keys: Map<string, TeamRole>): Promise<void> => {
    for (const [roleId, key] of keys) {
        const [value, id] = placeholders(runner, 2);
        await runner.query(`UPDATE "${table}" SET "role" = ${value} WHERE "role" = ${id}`, [key, roleId]);
    }

    // A reference to a role that no longer existed gets the least access.
    const [fallback, ...known] = placeholders(runner, 1 + TEAM_ROLES.length);
    await runner.query(
        `UPDATE "${table}" SET "role" = ${fallback} WHERE "role" NOT IN (${known.join(', ')})`,
        [TeamRole.Viewer, ...TEAM_ROLES]
    );
};

const dropLegacyForeignKeys = async (runner: QueryRunner, table: string): Promise<void> => {
    const loaded = await runner.getTable(table);
    if (!loaded) return;

    for (const foreignKey of loaded.foreignKeys) {
        if (foreignKey.referencedTableName === LEGACY_TABLE) {
            await runner.dropForeignKey(loaded, foreignKey);
        }
    }
};

export const retireTeamRoles = async (dataSource: DataSource): Promise<void> => {
    const runner = dataSource.createQueryRunner();
    const sqlite = dataSource.options.type === 'better-sqlite3';

    try{
        if(!await runner.hasTable(LEGACY_TABLE)) return;

        const rows: LegacyRoleRow[] = await runner.query(`SELECT "id", "name", "permissions", "isSystem" FROM "${LEGACY_TABLE}"`);
        const keys = new Map(rows.map((row) => [row.id, keyOf(row)]));

        // SQLite checks every write against its foreign keys and can drop one only by rebuilding
        // the table, which synchronize does next anyway; Postgres drops them in place.
        if(sqlite) await runner.query('PRAGMA foreign_keys = OFF');
        try{
            for(const table of REFERRING_TABLES){
                if(!await runner.hasTable(table)) continue;

                if(!sqlite) await dropLegacyForeignKeys(runner, table);
                await rewriteReferences(runner, table, keys);
            }
        }finally{
            if(sqlite) await runner.query('PRAGMA foreign_keys = ON');
        }

        const custom = rows.filter((row) => !row.isSystem).length;
        logger.info(`@database: replaced ${rows.length} team_roles rows (${custom} custom) with fixed role keys`);
    }finally{
        await runner.release();
    }
};
