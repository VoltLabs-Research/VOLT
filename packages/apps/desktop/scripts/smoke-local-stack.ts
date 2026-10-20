import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import AppConfig from '@/services/AppConfig';
import bus from '@/services/EventBus';
import LocalDeploy from '@/services/LocalDeploy';
import { pluginRoutes } from '@volt/contracts/modules/plugin/routes';
import ServerApi from '@/services/ServerApi';

const root = process.env.SMOKE_ROOT ?? '/tmp/volt-desktop-smoke';
const runtimeDir = process.env.SMOKE_RUNTIME ?? path.resolve('stack-runtime');
const keepData = process.argv.includes('--keep');

const check = (label: string, ok: boolean): void => {
    console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${label}`);
    if(!ok) process.exitCode = 1;
};

const main = async () => {
    if(!keepData) await rm(root, { recursive: true, force: true });
    await mkdir(root, { recursive: true });

    bus.on('deploy:phase', ({ id, status, detail }) => console.log(`[phase] ${id} ${status}${detail ? ` — ${detail}` : ''}`));
    bus.on('deploy:state', ({ state, message }) => console.log(`[state] ${state}${message ? ` — ${message}` : ''}`));
    bus.on('deploy:log', ({ line }) => { if(/\[(bootstrap|plugins|stack)\]|error|Error|EACCES/.test(line)) console.log(`      ${line.slice(0, 200)}`); });

    const appConfig = new AppConfig({ configFile: path.join(root, 'app-config.json') });
    const deploy = new LocalDeploy({
        appConfig,
        paths: {
            runtimeDir,
            stackDataDir: path.join(root, 'local-stack'),
            logsDir: path.join(root, 'local-stack', 'logs')
        }
    });

    const startedAt = Date.now();
    await deploy.start();
    console.log(`\nstack up in ${Math.round((Date.now() - startedAt) / 1000)}s`);

    const origin = deploy.serverOrigin();
    check('server origin resolved', origin !== null);
    const clientUrl = await deploy.clientUrl();
    check('client url carries the auth token', !!clientUrl && clientUrl.includes('/__bootstrap.html?token='));

    const html = await (await fetch(`${origin}/`, { headers: { Accept: 'text/html' } })).text();
    check('client index served with endpoint injection', html.includes('__VOLT_SERVER_ENDPOINT__') && html.includes('__nav-bridge.js'));

    const bootstrap = await appConfig.getBootstrap();
    check('bootstrap persisted', !!bootstrap?.teamClusterId);

    const api = new ServerApi(origin!);
    const page = await api.request<{ total?: number; data?: unknown[] }>(pluginRoutes.list, {
        params: { teamId: bootstrap!.teamId },
        token: bootstrap!.authToken
    });
    const installed = page.total ?? page.data?.length ?? 0;
    console.log(`  plugins installed: ${installed}`);
    check('default plugins seeded', installed >= 15);

    const seed = await appConfig.getPluginSeed();
    check('plugin seed recorded', !!seed && seed.installed.length === installed);

    console.log('\nrestarting to exercise the reuse path');
    await deploy.stop();
    const restartedAt = Date.now();
    await deploy.start();
    console.log(`stack back up in ${Math.round((Date.now() - restartedAt) / 1000)}s`);
    check('second start reuses the workspace', (await appConfig.getBootstrap())?.teamClusterId === bootstrap!.teamClusterId);

    await deploy.stop();
    check('stopped cleanly', deploy.serverOrigin() === null);
    console.log(process.exitCode ? '\nSMOKE FAILED' : '\nSMOKE OK');
};

main().catch((err) => {
    console.error('SMOKE EXCEPTION', err);
    process.exit(1);
});
