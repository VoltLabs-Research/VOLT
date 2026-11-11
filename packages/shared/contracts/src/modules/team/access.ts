// A team member holds one of four fixed roles. They are ordered: each role may do everything the
// roles below it may. The roles live here and nowhere else; the database stores only the key.
export enum TeamRole{
    Viewer = 'viewer',
    Member = 'member',
    Admin = 'admin',
    Owner = 'owner'
}

// The parts of a team that are guarded separately.
export enum TeamArea{
    Trajectory = 'trajectory',
    Analysis = 'analysis',
    Plugin = 'plugin',
    Scripting = 'scripting',
    Whiteboard = 'whiteboard',
    SimulationCell = 'simulation-cell',
    DailyActivity = 'daily-activity',
    AIConversation = 'ai-conversation',
    // The team's clusters: anyone who reads the team's data needs to see where it lives.
    Cluster = 'cluster',
    Team = 'team',
    TeamInvitation = 'team-invitation',
    TeamMember = 'team-member',
    TeamSecretKey = 'team-secret-key'
}

export enum TeamAccess{
    Read = 'read',
    Write = 'write'
}

const TEAM_ROLE_ORDER: readonly TeamRole[] = [TeamRole.Viewer, TeamRole.Member, TeamRole.Admin, TeamRole.Owner];

const TEAM_ROLE_LABELS: Readonly<Record<TeamRole, string>> = {
    [TeamRole.Viewer]: 'Viewer',
    [TeamRole.Member]: 'Member',
    [TeamRole.Admin]: 'Admin',
    [TeamRole.Owner]: 'Owner'
};

// The lowest role that may read, and the lowest that may change, each area.
const TEAM_AREA_ACCESS: Readonly<Record<TeamArea, Readonly<Record<TeamAccess, TeamRole>>>> = {
    [TeamArea.Trajectory]: { read: TeamRole.Viewer, write: TeamRole.Member },
    [TeamArea.Analysis]: { read: TeamRole.Viewer, write: TeamRole.Member },
    [TeamArea.Plugin]: { read: TeamRole.Viewer, write: TeamRole.Member },
    [TeamArea.Scripting]: { read: TeamRole.Viewer, write: TeamRole.Member },
    [TeamArea.Whiteboard]: { read: TeamRole.Viewer, write: TeamRole.Member },
    [TeamArea.SimulationCell]: { read: TeamRole.Viewer, write: TeamRole.Admin },
    [TeamArea.DailyActivity]: { read: TeamRole.Viewer, write: TeamRole.Admin },
    [TeamArea.AIConversation]: { read: TeamRole.Member, write: TeamRole.Member },
    [TeamArea.Cluster]: { read: TeamRole.Viewer, write: TeamRole.Owner },
    [TeamArea.Team]: { read: TeamRole.Member, write: TeamRole.Owner },
    [TeamArea.TeamInvitation]: { read: TeamRole.Admin, write: TeamRole.Admin },
    [TeamArea.TeamMember]: { read: TeamRole.Member, write: TeamRole.Admin },
    [TeamArea.TeamSecretKey]: { read: TeamRole.Owner, write: TeamRole.Owner }
};

export const TEAM_ROLES: readonly TeamRole[] = TEAM_ROLE_ORDER;

export const isTeamRole = (value: unknown): value is TeamRole =>
    typeof value === 'string' && (TEAM_ROLE_ORDER as readonly string[]).includes(value);

export const teamRoleLabel = (role: TeamRole): string => TEAM_ROLE_LABELS[role];

export const hasTeamRole = (role: TeamRole | null | undefined, minimum: TeamRole): boolean =>
    role !== null && role !== undefined && TEAM_ROLE_ORDER.indexOf(role) >= TEAM_ROLE_ORDER.indexOf(minimum);

export const requiredTeamRole = (area: TeamArea, access: TeamAccess): TeamRole => TEAM_AREA_ACCESS[area][access];

export const canAccessTeamArea = (role: TeamRole | null | undefined, area: TeamArea, access: TeamAccess): boolean =>
    hasTeamRole(role, requiredTeamRole(area, access));
