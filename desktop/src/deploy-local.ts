import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir } from 'node:fs/promises';
import AppConfig from '@/services/AppConfig';
import SourceResolver from '@/services/SourceResolver';
import Deploy from '@/services/Deploy';
import bus from '@/services/EventBus';
import { LOCAL_DEFAULTS } from '@/services/localDefaults';

const moduleDir = typeof __dirname !== 'undefined'
    ? __dirname
    : path.dirname(fileURLToPath(import.meta.url));

const dataDir = process.env.VOLT_DEPLOY_DATA ?? path.join(process.cwd(), '.volt-deploy');
const withCluster = process.env.VOLT_WITH_CLUSTER === 'true';

const stamp = () => new Date().toISOString().slice(11, 19);

const main = async () => {
    const downloadDir = path.join(dataDir, 'downloads');
    await mkdir(downloadDir, { recursive: true });

    const appConfig = new AppConfig({ configFile: path.join(dataDir, 'app-config.json') });
    const composeFile = process.env.VOLT_COMPOSE_FILE ?? path.join(moduleDir, '..', 'stack', 'compose.yml');

    bus.on('deploy:log', ({ stream, line }) => process.stdout.write(`[${stamp()}] ${stream === 'stderr' ? '! ' : '  '}${line}\n`));
    bus.on('deploy:phase', ({ id, status, detail }) => process.stdout.write(`[${stamp()}] PHASE ${id} ${status}${detail ? ` :: ${detail}` : ''}\n`));
    bus.on('deploy:state', ({ state, message }) => process.stdout.write(`[${stamp()}] STATE ${state}${message ? ` :: ${message}` : ''}\n`));
    bus.on('deploy:preflight', ({ ok, reason, serverVersion, composeVersion }) =>
        process.stdout.write(`[${stamp()}] PREFLIGHT ok=${ok} reason=${reason} docker=${serverVersion ?? '?'} compose=${composeVersion ?? '?'}\n`));

    const deploy = new Deploy({
        composeFile,
        appConfig,
        sources: new SourceResolver({
            appConfig,
            downloadDir
        }),
        account: {
            ...LOCAL_DEFAULTS,
            fullName: 'Local Admin',
            autoJoinNewUsers: false
        },
        withCluster
    });

    await deploy.start();

    const env = await appConfig.getStackEnv();
    const bootstrap = await appConfig.getBootstrap();
    process.stdout.write([
        '',
        'DEPLOY OK',
        `  client       ${env.CLIENT_HOST}`,
        `  server       ${env.SERVER_ENDPOINT}`,
        `  minio        ${env.MINIO_PUBLIC_URL}`,
        `  cluster      ${withCluster ? 'daemon running' : 'server only'}`,
        `  teamId       ${bootstrap?.teamId ?? '-'}`,
        `  clusterId    ${bootstrap?.teamClusterId ?? '-'}`,
        ''
    ].join('\n'));
};

main().catch((error) => {
    process.stderr.write(`DEPLOY FAILED: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exit(1);
});
