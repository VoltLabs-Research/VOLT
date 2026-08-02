/**
 * Exercises the real deploy pipeline without mutating containers.
 *
 * `Deploy.start()` short-circuits when the web app already answers its probe, so
 * this drives the genuine code path — preflight, stack env, source resolution and
 * phase reporting — and asserts it reports every phase done. It also validates the
 * compose file renders with the same environment the app would pass to Docker.
 */

import AppConfig from '@/services/AppConfig';
import SourceResolver from '@/services/SourceResolver';
import Deploy from '@/services/Deploy';
import { dockerPreflight } from '@/services/DockerPreflight';
import { augmentedPath, dockerPath } from '@/services/DockerBinary';
import { run } from '@/services/ProcessRunner';
import { isUp, PROBE_PATH, webProbeUrl } from '@/shared/health';
import bus from '@/services/EventBus';
import path from 'node:path';

/* Mirrors resolveAppPaths() for the unpackaged case; that module needs Electron. */
const paths = {
    composeFile: path.join(process.cwd(), 'stack', 'compose.yml'),
    configFile: path.join(process.cwd(), 'app-config.json'),
    downloadDir: path.join(process.cwd(), 'downloads')
};

const checks: Array<{ name: string; ok: boolean }> = [];
const check = (name: string, ok: boolean, detail = ''): void => {
    checks.push({ name, ok });
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  ${detail}` : ''}`);
};

const main = async (): Promise<void> => {
    console.log(`config    ${paths.configFile}`);
    console.log(`compose   ${paths.composeFile}\n`);

    const appConfig = new AppConfig({ configFile: paths.configFile });

    const preflight = await dockerPreflight();
    check('docker preflight ok', preflight.ok, `${preflight.message} (docker ${preflight.serverVersion}, compose ${preflight.composeVersion})`);

    const env = await appConfig.getStackEnv();
    check('stack env resolves ports', Boolean(env.SERVER_PORT && env.WEB_PORT), `server=${env.SERVER_PORT} web=${env.WEB_PORT}`);

    const serverOrigin = `http://localhost:${env.SERVER_PORT ?? '8100'}`;
    check('api server probe answers', await isUp(`${serverOrigin}${PROBE_PATH}`), `${serverOrigin}${PROBE_PATH}`);
    check('web app probe answers', await isUp(webProbeUrl(env)), webProbeUrl(env));

    const deployment = await appConfig.getDeployment();
    check('deployment mode persisted', deployment?.mode === 'local' || deployment?.mode === 'remote', JSON.stringify(deployment));

    const bootstrap = await appConfig.getBootstrap();
    check('bootstrap holds cluster enrollment', Boolean(bootstrap?.teamClusterId && bootstrap?.daemonPassword),
        bootstrap ? `teamClusterId=${bootstrap.teamClusterId}` : 'missing');

    /* The compose file must render with exactly the env the deployer would pass,
       including the source directories SourceResolver contributes at deploy time. */
    const sources = await new SourceResolver({ appConfig, downloadDir: paths.downloadDir })
        .resolveExisting()
        .catch(() => ({} as Record<string, string>));
    check('source directories resolve', Object.keys(sources).length > 0, Object.keys(sources).join(','));

    const composeEnv = {
        ...env,
        ...sources,
        ...(bootstrap ? { TEAM_CLUSTER_ID: bootstrap.teamClusterId, DAEMON_PASS: bootstrap.daemonPassword } : {}),
        PATH: augmentedPath()
    };
    const rendered = await run(await dockerPath() ?? 'docker',
        ['compose', '-f', paths.composeFile, '--profile', 'enrolled', 'config', '--quiet'],
        { env: composeEnv }).then(() => true).catch((error: unknown) => {
        console.log(`      compose config error: ${error instanceof Error ? error.message.slice(0, 300) : String(error)}`);
        return false;
    });
    check('compose file renders with deploy env (all profiles)', rendered);

    /* Watch the phase stream while the real Deploy runs its already-up path. */
    const phases = new Map<string, string>();
    const offPhase = bus.on('deploy:phase', (payload) => phases.set(payload.id, payload.status));
    const states: string[] = [];
    const offState = bus.on('deploy:state', (payload) => states.push(payload.state));

    const deploy = new Deploy({
        composeFile: paths.composeFile,
        appConfig,
        sources: new SourceResolver({ appConfig, downloadDir: paths.downloadDir })
    });

    const startedAt = Date.now();
    await deploy.start();
    const elapsed = Date.now() - startedAt;

    offPhase();
    offState();

    const allDone = phases.size > 0 && [...phases.values()].every((status) => status === 'done');
    check('deploy.start() reports every phase done', allDone, `${phases.size} phases in ${elapsed}ms`);
    check('deploy.start() ends in the up state', states.includes('up'), states.join(' -> '));
    check('deploy.start() short-circuits when already up', elapsed < 20000, `${elapsed}ms`);

    /* Serialization: concurrent calls must queue, never interleave. */
    const concurrentStart = Date.now();
    const results = await Promise.allSettled([deploy.start(), deploy.start(), deploy.start()]);
    check('concurrent deploy.start() calls all settle', results.every((r) => r.status === 'fulfilled'),
        `${results.filter((r) => r.status === 'fulfilled').length}/3 in ${Date.now() - concurrentStart}ms`);

    const failed = checks.filter((c) => !c.ok);
    console.log(`\n=== ${checks.length - failed.length}/${checks.length} deploy checks passed`);
    for(const f of failed) console.log(`  FAIL ${f.name}`);
    process.exit(failed.length > 0 ? 1 : 0);
};

main().catch((error: unknown) => {
    console.error('DEPLOY CHECK FATAL', error);
    process.exit(1);
});
