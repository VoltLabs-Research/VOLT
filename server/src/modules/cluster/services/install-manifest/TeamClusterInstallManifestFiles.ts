import { DaemonDistributionMode } from '@modules/cluster/services/install-manifest/TeamClusterDaemonManifestSource';
import type {
    TeamClusterInstallManifestFileView,
    TeamClusterInstallManifestPortsView
} from '@modules/cluster/services/TeamClusterInstallManifest';
import type { DecryptedTeamClusterServiceCredentials } from '@modules/cluster/services/DaemonCredentialGuard';

export const TEAM_CLUSTER_INSTALL_MANIFEST_VERSION = '1.0.0';

export const TEAM_CLUSTER_IMAGES = {
    postgres: 'postgres:17-alpine',
    daemon: 'ghcr.io/voltlabs-research/volt-cluster-daemon:main'
};

interface BuildInstallManifestFilesInput {
    teamId: string;
    teamClusterId: string;
    installRoot: string;
    ports: TeamClusterInstallManifestPortsView;
    cloudUrl: string;
    credentials: DecryptedTeamClusterServiceCredentials;
    daemonDistributionMode: DaemonDistributionMode;
    daemonFiles: TeamClusterInstallManifestFileView[];
}

export const sanitizeComposeProjectName = (teamClusterId: string): string => {
    const alphanumericOnly = teamClusterId.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const suffix = alphanumericOnly.slice(0, 12) || 'cluster';

    return `voltcluster${suffix}`;
};

const buildComposeFile = (daemonDistributionMode: DaemonDistributionMode): string => {
    /*
     * The build context is the install directory itself: it mirrors the repository
     * layout (cluster/ + sdk/) that the daemon's Dockerfile expects, because the
     * daemon links @voltstack/daemon-cluster-client from the repository.
     */
    const daemonBuildConfiguration = daemonDistributionMode === DaemonDistributionMode.Build
        ? [
            '    build:',
            '      context: .',
            '      dockerfile: cluster/Dockerfile',
            '    pull_policy: build'
        ]
        : [];

    return [
        'services:',
        '  postgres:',
        '    image: ${POSTGRES_IMAGE}',
        '    restart: unless-stopped',
        '    env_file:',
        '      - ./postgres.env',
        '    healthcheck:',
        '      test: ["CMD-SHELL", "pg_isready -U $$POSTGRES_USER -d $$POSTGRES_DB"]',
        '      interval: 10s',
        '      retries: 20',
        '    ports:',
        '      - "${POSTGRES_PORT}:5432"',
        '    volumes:',
        '      - postgres-data:/var/lib/postgresql/data',
        '  daemon:',
        '    image: ${VOLT_CLUSTER_DAEMON_IMAGE}',
        ...daemonBuildConfiguration,
        '    restart: always',
        '    env_file:',
        '      - ./.env',
        '      - ./daemon.env',
        '    depends_on:',
        '      - postgres',
        '    volumes:',
        '      - /var/run/docker.sock:/var/run/docker.sock',
        // The object store lives on the daemon's own disk now, so this holds the
        // cluster's data rather than a cache and must outlive the container.
        '      - daemon-data:/var/lib/volt-daemon',
        'volumes:',
        '  postgres-data:',
        '  daemon-data:'
    ].join('\n');
};

const buildRootEnvFile = (
    teamClusterId: string,
    installRoot: string,
    ports: TeamClusterInstallManifestPortsView,
    cloudUrl: string
): string => {
    return [
        `TEAM_CLUSTER_ID=${teamClusterId}`,
        `COMPOSE_PROJECT_NAME=${sanitizeComposeProjectName(teamClusterId)}`,
        `TEAM_CLUSTER_INSTALL_ROOT=${installRoot}`,
        `VOLT_CLOUD_URL=${cloudUrl}`,
        `POSTGRES_IMAGE=${TEAM_CLUSTER_IMAGES.postgres}`,
        `VOLT_CLUSTER_DAEMON_IMAGE=${TEAM_CLUSTER_IMAGES.daemon}`,
        `POSTGRES_PORT=${ports.postgres}`
    ].join('\n');
};

const buildPostgresEnvFile = (credentials: DecryptedTeamClusterServiceCredentials): string => {
    return [
        `POSTGRES_USER=${credentials.postgresUsername}`,
        `POSTGRES_PASSWORD=${credentials.postgresPassword}`,
        /* The daemon creates its own database if absent, but naming it here saves a round trip. */
        'POSTGRES_DB=volt-cluster'
    ].join('\n');
};

const buildDaemonEnvFile = (
    teamId: string,
    teamClusterId: string,
    installRoot: string,
    credentials: DecryptedTeamClusterServiceCredentials,
    cloudUrl: string
): string => {
    return [
        `TEAM_ID=${teamId}`,
        `TEAM_CLUSTER_ID=${teamClusterId}`,
        `COMPOSE_PROJECT_NAME=${sanitizeComposeProjectName(teamClusterId)}`,
        `TEAM_CLUSTER_INSTALL_ROOT=${installRoot}`,
        `VOLT_CLOUD_URL=${cloudUrl}`,
        `TEAM_CLUSTER_DAEMON_PASSWORD=${credentials.daemonPassword}`,
        'DAEMON_DATA_DIR=/var/lib/volt-daemon',
        `DATABASE_URL=postgres://${credentials.postgresUsername}:${credentials.postgresPassword}@postgres:5432/volt-cluster`,
        'PORT=8080'
    ].join('\n');
};

export const buildTeamClusterInstallManifestFiles = ({
    teamId,
    teamClusterId,
    installRoot,
    ports,
    cloudUrl,
    credentials,
    daemonDistributionMode,
    daemonFiles
}: BuildInstallManifestFilesInput): TeamClusterInstallManifestFileView[] => {
    return [
        {
            path: 'docker-compose.yml',
            contents: buildComposeFile(daemonDistributionMode),
            mode: '0644'
        },
        {
            path: '.env',
            contents: buildRootEnvFile(teamClusterId, installRoot, ports, cloudUrl),
            mode: '0600'
        },
        {
            path: 'postgres.env',
            contents: buildPostgresEnvFile(credentials),
            mode: '0600'
        },
        {
            path: 'daemon.env',
            contents: buildDaemonEnvFile(teamId, teamClusterId, installRoot, credentials, cloudUrl),
            mode: '0600'
        },
        ...daemonFiles
    ];
};
