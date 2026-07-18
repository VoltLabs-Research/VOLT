import { fileURLToPath } from 'node:url';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import { parseArgs } from 'node:util';
import { mkdir } from 'node:fs/promises';
import * as p from '@clack/prompts';
import AppConfig from '@/services/AppConfig';
import type { DeployMode } from '@/services/AppConfig';
import { createSourceResolver } from '@/services/sources';
import DockerPreflight from '@/services/DockerPreflight';
import Deploy from '@/services/Deploy';
import DeployProgress from '@/services/DeployProgress';
import { isUp, webProbeUrl } from '@/shared/health';

const EXIT_USAGE = 2;
const EXIT_UPDATE_AVAILABLE = 10;

const HELP = `Deploy VOLT — local stack deployer

Usage:
  deploy.sh                       Fresh interactive deploy (prompts for host/account/team)
  deploy.sh --update              Update an existing deployment to the latest release
  deploy.sh --check               Preview whether an update is available (no changes)

Update options:
  --server-only                   Run server only; stop the cluster daemon (persists the mode)
  --with-cluster                  Run server + cluster daemon (persists the mode)
  --force                         Rebuild even if already on the latest release
  --data-dir <path>               Use a specific deployment data directory
  -h, --help                      Show this help

Notes:
  --update keeps your data (mongo/redis/minio); it rebuilds and reinstalls deps.
  In dev mode (configured app-config.json), --update rebuilds from local checkouts
  and does not pull from GitHub releases.
  Set GITHUB_TOKEN to raise the GitHub API rate limit for --update/--check.

Exit codes: 0 ok/up-to-date · 1 failure · 2 usage/no deployment · 10 update available (--check).
`;

const moduleDir = typeof __dirname !== 'undefined'
    ? __dirname
    : path.dirname(fileURLToPath(import.meta.url));

const detectIp = (): string => {
    for(const ifaces of Object.values(os.networkInterfaces())){
        for(const iface of ifaces ?? []){
            if(iface.family === 'IPv4' && !iface.internal) return iface.address;
        }
    }
    return '';
};

const required = (value: string | undefined) => (value && value.trim() ? undefined : 'Required');

const printSummary = (env: Record<string, string>, withCluster: boolean, email: string, consoleReady: boolean) => {
    if(consoleReady){
        p.note(`VOLT Cloud ID  ${email}\nManage your services at console.voltcloud.dev`, 'Cloud Services');
    }
    p.note(
        [
            `Client    ${env.CLIENT_HOST}`,
            `Server    ${env.SERVER_ENDPOINT}`,
            `Cluster   ${withCluster ? 'daemon running' : 'server only'}`,
            '',
            'Connect from any device:',
            '  Desktop app  https://github.com/VoltLabs-Research/VOLT/releases/latest',
            `  When asked for the server address, enter ${env.SERVER_ENDPOINT}`
        ].join('\n'),
        'VOLT is up'
    );
    p.outro('Deployment complete.');
};

interface CliFlags{
    update: boolean;
    check: boolean;
    serverOnly: boolean;
    withCluster: boolean;
    force: boolean;
    help: boolean;
    dataDir?: string;
}

const parseFlags = (): CliFlags => {
    
    
    const { values } = parseArgs({
        args: process.argv.slice(2),
        strict: false,
        options: {
            update: { type: 'boolean' },
            check: { type: 'boolean' },
            'server-only': { type: 'boolean' },
            'with-cluster': { type: 'boolean' },
            force: { type: 'boolean' },
            'data-dir': { type: 'string' },
            help: { type: 'boolean', short: 'h' }
        }
    });

    return {
        update: values.update === true,
        check: values.check === true,
        serverOnly: values['server-only'] === true,
        withCluster: values['with-cluster'] === true,
        force: values.force === true,
        help: values.help === true,
        dataDir: typeof values['data-dir'] === 'string' ? values['data-dir'] : undefined
    };
};

const main = async () => {
    const flags = parseFlags();

    if(flags.help){
        process.stdout.write(HELP);
        return;
    }

    const nonInteractive = flags.update || flags.check;

    
    if(!flags.check) p.intro('Deploy VOLT');

    const dataDir = flags.dataDir
        ?? process.env.VOLT_DEPLOY_DATA
        ?? path.join(process.cwd(), '.volt-deploy');
    const downloadDir = path.join(dataDir, 'downloads');
    await mkdir(downloadDir, { recursive: true });

    const appConfig = new AppConfig({ configFile: path.join(dataDir, 'app-config.json') });
    const composeFile = process.env.VOLT_COMPOSE_FILE ?? path.join(moduleDir, '..', 'stack', 'compose.yml');
    const docker = new DockerPreflight();
    const progress = new DeployProgress();
    const sources = createSourceResolver(appConfig, downloadDir);

    const existing = await appConfig.getBootstrap();

    if(flags.serverOnly && flags.withCluster){
        p.log.error('--server-only and --with-cluster are mutually exclusive.');
        process.exit(EXIT_USAGE);
    }

    
    
    const runUpdate = async (withCluster: boolean, email: string) => {
        const deploy = new Deploy({ composeFile, appConfig, sources, docker, withCluster });
        progress.start();
        await deploy.update();
        progress.stop();
        printSummary(await appConfig.getStackEnv(), withCluster, email, false);
    };

    
    if(nonInteractive){
        if(!existing){
            p.log.error(`No existing VOLT deployment found in ${dataDir}.`);
            p.log.message('Run without --update to deploy first, or pass --data-dir / set VOLT_DEPLOY_DATA to your deployment directory.');
            process.exit(EXIT_USAGE);
        }

        if(flags.check){
            const status = await sources.checkForUpdates();
            if(status.devMode){
                p.log.message('Dev mode active: --update rebuilds from local checkouts; no GitHub release to compare.');
                p.outro('Up to date (dev mode).');
                return;
            }
            for(const repo of status.repos){
                const line = repo.changed
                    ? `${repo.repoId}: ${repo.installed ?? 'none'} → ${repo.latest} (update available)`
                    : `${repo.repoId}: ${repo.latest} (up to date)`;
                p.log.message(line);
            }
            const available = status.repos.some((r) => r.changed);
            p.outro(available ? 'Update available.' : 'Already up to date.');
            if(available) process.exit(EXIT_UPDATE_AVAILABLE);
            return;
        }

        
        
        const currentMode = await appConfig.getMode();
        const withCluster = flags.withCluster ? true
            : flags.serverOnly ? false
            : currentMode !== 'server';
        const desiredMode = withCluster ? 'cluster' : 'server';
        const modeChanged = (flags.serverOnly || flags.withCluster) && currentMode !== desiredMode;
        if(flags.serverOnly || flags.withCluster){
            await appConfig.setMode(desiredMode);
        }

        
        
        
        
        if(!flags.force && !modeChanged){
            const status = await sources.checkForUpdates();
            const env = await appConfig.getStackEnv();
            if(!status.devMode && !status.repos.some((r) => r.changed) && await isUp(webProbeUrl(env))){
                p.log.success(`Already up to date (${status.repos.map((r) => `${r.repoId.split('/').pop()}@${r.latest}`).join(', ')}).`);
                p.outro('Nothing to update.');
                return;
            }
        }

        await runUpdate(withCluster, existing.email);
        return;
    }

    
    if(existing){
        const choice = await p.select({
            message: `Existing deployment found (${existing.email}). What would you like to do?`,
            options: [
                { value: 'update', label: 'Update — pull latest and rebuild (keeps your data)' },
                { value: 'reset', label: 'Reset & re-deploy — wipe all data and start fresh' }
            ]
        });
        if(p.isCancel(choice)){ p.cancel('Deployment cancelled.'); process.exit(1); }

        if(choice === 'update'){
            await runUpdate((await appConfig.getMode()) !== 'server', existing.email);
            return;
        }
    }

    
    
    if(!process.stdin.isTTY){
        p.log.error('Interactive deployment needs a terminal.');
        p.log.message('Run with --update to update an existing deployment non-interactively, or --help for usage.');
        process.exit(EXIT_USAGE);
    }

    const answers = await p.group({
        host: () => p.text({ message: 'Server host or domain', initialValue: detectIp(), validate: required }),
        mode: () => p.select<DeployMode>({
            message: 'What do you want to deploy on this machine?',
            initialValue: 'cluster',
            options: [
                { value: 'cluster', label: 'Server + cluster (daemon)' },
                { value: 'server', label: 'Server only' }
            ]
        }),
        fullName: () => p.text({ message: 'Full name', validate: required }),
        email: () => p.text({ message: 'Email', validate: required }),
        username: () => p.text({ message: 'Username', validate: (v) => (/^[a-z0-9][a-z0-9-]{1,38}$/.test(v ?? '') ? undefined : 'Lowercase letters, digits and dashes (2-39)') }),
        password: () => p.password({ message: 'Password', validate: (v) => ((v?.length ?? 0) >= 8 ? undefined : 'Min 8 characters') }),
        teamName: () => p.text({ message: 'Team name', validate: required }),
        clusterName: () => p.text({ message: 'Cluster name', validate: required }),
        autoJoinNewUsers: () => p.confirm({ message: 'Automatically add everyone who signs up to this team?', initialValue: false })
    }, { onCancel: () => { p.cancel('Deployment cancelled.'); process.exit(1); } });

    const withCluster = answers.mode !== 'server';
    await appConfig.setMode(answers.mode);

    const env = await appConfig.getStackEnv();
    env.SECRET_KEY ||= crypto.randomBytes(32).toString('hex');
    env.SSH_KEY ||= crypto.randomBytes(32).toString('hex');
    env.WEB_PORT ||= '5273';
    env.SERVER_PORT ||= '8100';
    env.MINIO_PORT ||= '9100';
    env.DEPLOYMENT_MODE = 'cloud';
    env.CLIENT_HOST = `http://${answers.host}:${env.WEB_PORT}`;
    env.SERVER_ENDPOINT = `http://${answers.host}:${env.SERVER_PORT}`;
    env.MINIO_PUBLIC_URL = `http://${answers.host}:${env.MINIO_PORT}`;
    await appConfig.setStackEnv(env);

    const deploy = new Deploy({
        composeFile,
        appConfig,
        sources,
        docker,
        account: {
            fullName: answers.fullName,
            email: answers.email,
            password: answers.password,
            teamName: answers.teamName,
            clusterName: answers.clusterName,
            autoJoinNewUsers: answers.autoJoinNewUsers
        },
        withCluster
    });

    const consoleUrl = process.env.VOLT_CONSOLE_URL ?? 'https://server.console.voltcloud.dev';
    let consoleReady = false;
    const consoleSpinner = p.spinner();
    consoleSpinner.start('Setting up your VOLT Cloud ID');
    try {
        const res = await fetch(`${consoleUrl}/auth/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: answers.email, username: answers.username, password: answers.password }),
            signal: AbortSignal.timeout(15_000)
        });
        consoleReady = res.ok || res.status === 409;
        consoleSpinner.stop(res.ok
            ? 'VOLT Cloud ID created (console.voltcloud.dev)'
            : res.status === 409
                ? 'VOLT Cloud ID already exists (console.voltcloud.dev)'
                : `VOLT Cloud sign-up skipped (HTTP ${res.status})`);
    } catch {
        consoleSpinner.stop('VOLT Cloud sign-up skipped (unreachable)');
    }

    progress.start();
    if(existing) await deploy.resetAndRedeploy();
    else await deploy.start();
    progress.stop();

    printSummary(await appConfig.getStackEnv(), withCluster, answers.email, consoleReady);
};

main().catch((error) => {
    p.log.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
});
