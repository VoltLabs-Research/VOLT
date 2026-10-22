import { ActivityType } from '@volt/contracts/modules/daily-activity/domain';
import { LANDING_COLLEAGUES, LANDING_OWNER, LANDING_PEOPLE } from '@/modules/marketing/utils/landing-peers';

export const LANDING_TEAM_ID = 'landing-team';
export const LANDING_CLUSTER_ID = 'landing-cluster';
export const LANDING_CLUSTER_NAME = 'lab-workstation';

const HOUR_MS = 3_600_000;

// When something happened, `hours` before the screen opened: the app shows times relative to now.
export const hoursAgo = (hours: number): string => new Date(Date.now() - hours * HOUR_MS).toISOString();

const JOINED = hoursAgo(24 * 61);


const person = (peer: (typeof LANDING_PEOPLE)[number]) => ({
    _id: peer.id,
    email: `${peer.firstName.toLowerCase()}@materials-lab.example`,
    firstName: peer.firstName,
    lastName: peer.lastName
});

export const LANDING_USER = {
    ...person(LANDING_OWNER),
    createdAt: JOINED,
    updatedAt: hoursAgo(1),
    role: 'user',
    passwordChangedAt: null,
    lastLoginAt: hoursAgo(1),
    lastSeenAt: hoursAgo(0),
    teams: [LANDING_TEAM_ID],
    analyses: [],
    oauthProvider: null,
    oauthId: null,
    fullName: `${LANDING_OWNER.firstName} ${LANDING_OWNER.lastName}`
};

export const LANDING_TEAM = {
    _id: LANDING_TEAM_ID,
    createdAt: JOINED,
    updatedAt: JOINED,
    name: 'Materials Lab',
    description: '',
    owner: LANDING_USER,
    inviteCode: null
};

export const LANDING_CLUSTER = {
    _id: LANDING_CLUSTER_ID,
    name: LANDING_CLUSTER_NAME,
    team: LANDING_TEAM_ID,
    createdBy: LANDING_OWNER.id,
    status: 'connected',
    installedVersion: null,
    lastHeartbeatAt: hoursAgo(0),
    lastDisconnectAt: null,
    services: { postgres: { port: null }, daemon: { port: null } },
    queueConcurrency: { analysis: 8, rasterizer: 8, glbPreprocessing: 16, artifactUpload: 16, pluginWarmup: 4 },
    roleConfig: {
        desiredRole: 'cluster',
        effectiveRole: 'cluster',
        runtimeVersion: 1,
        draining: { compute: false, storage: false },
        lastAppliedAt: JOINED
    },
    effectiveCapabilities: {
        acceptsComputeJobs: true,
        acceptsStorageWrites: true,
        servesStorageReads: true,
        servesArtifactDownloads: true
    },
    hostCapabilities: { containerRuntime: true, platform: 'linux-x86_64' },
    activeTransfers: [],
    createdAt: JOINED,
    updatedAt: hoursAgo(0)
};

const ROLES = {
    owner: { _id: 'landing-role-owner', name: 'Owner', permissions: ['*'], isSystem: true },
    member: { _id: 'landing-role-member', name: 'Member', permissions: ['trajectory:*', 'analysis:*', 'plugin:read'], isSystem: true }
};

export const LANDING_MEMBERS = LANDING_PEOPLE.map((peer, index) => ({
    _id: `landing-membership-${index}`,
    team: LANDING_TEAM_ID,
    user: { ...person(peer), createdAt: JOINED, isOnline: true, lastSeenAt: hoursAgo(0) },
    role: index === 0 ? ROLES.owner : ROLES.member,
    joinedAt: JOINED,
    createdAt: JOINED,
    updatedAt: JOINED,
    trajectoriesCount: [3, 2, 1][index] ?? 0,
    analysesCount: [4, 3, 2][index] ?? 0,
    whiteboardsCount: 0
}));

export const LANDING_NOTIFICATIONS = [
    {
        _id: 'landing-notification-analysis',
        recipient: LANDING_OWNER.id,
        title: 'Coordination Analysis finished',
        content: 'Shear Deformation: 3 frames analyzed on lab-workstation.',
        read: false,
        link: '/dashboard',
        createdAt: hoursAgo(1),
        updatedAt: hoursAgo(1)
    },
    {
        _id: 'landing-notification-member',
        recipient: LANDING_OWNER.id,
        title: `${LANDING_COLLEAGUES[1].firstName} ${LANDING_COLLEAGUES[1].lastName} joined Materials Lab`,
        content: 'They can open every trajectory the team has.',
        read: true,
        link: '/dashboard/my-team',
        createdAt: hoursAgo(26),
        updatedAt: hoursAgo(26)
    }
];

export const LANDING_ACTIVITY = [
    {
        _id: 'landing-activity-today',
        team: LANDING_TEAM_ID,
        user: { _id: LANDING_OWNER.id, firstName: LANDING_OWNER.firstName, lastName: LANDING_OWNER.lastName },
        date: hoursAgo(0),
        activity: [
            { type: ActivityType.AnalysisPerformed, description: 'Ran Coordination Analysis on "Shear Deformation"', createdAt: hoursAgo(1) },
            { type: ActivityType.TrajectoryUpload, description: 'Uploaded trajectory "Shear Deformation"', createdAt: hoursAgo(2) }
        ],
        minutesOnline: 74
    }
];
