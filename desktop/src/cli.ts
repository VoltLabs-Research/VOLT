import { fileURLToPath } from 'node:url';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import { mkdir } from 'node:fs/promises';
import * as p from '@clack/prompts';
import AppConfig from '@/services/AppConfig';
import SourceResolver from '@/services/SourceResolver';
import Repository from '@/services/Repository';
import DockerPreflight from '@/services/DockerPreflight';
import Deploy from '@/services/Deploy';
import DeployProgress from '@/services/DeployProgress';

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

const main = async () => {
    p.intro('Deploy VOLT');

    const answers = await p.group({
        host: () => p.text({ message: 'Server host or domain', initialValue: detectIp(), validate: required }),
        mode: () => p.select({
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
        clusterName: () => p.text({ message: 'Cluster name', validate: required })
    }, { onCancel: () => { p.cancel('Deployment cancelled.'); process.exit(1); } });

    const withCluster = answers.mode !== 'server';

    const dataDir = process.env.VOLT_DEPLOY_DATA ?? path.join(process.cwd(), '.volt-deploy');
    const downloadDir = path.join(dataDir, 'downloads');
    await mkdir(downloadDir, { recursive: true });

    const appConfig = new AppConfig({ configFile: path.join(dataDir, 'app-config.json') });

    const env = await appConfig.getStackEnv();
    env.SECRET_KEY ||= crypto.randomBytes(32).toString('hex');
    env.SSH_KEY ||= crypto.randomBytes(32).toString('hex');
    env.WEB_PORT ||= '5273';
    env.SERVER_PORT ||= '8100';
    env.DEPLOYMENT_MODE = 'cloud';
    env.CLIENT_HOST = `http://${answers.host}:${env.WEB_PORT}`;
    env.SERVER_ENDPOINT = `http://${answers.host}:${env.SERVER_PORT}`;
    await appConfig.setStackEnv(env);

    const progress = new DeployProgress();
    progress.start();

    const sources = new SourceResolver({
        appConfig,
        downloadDir,
        repos: [
            { repo: new Repository({ owner: 'voltlabs-research', repo: 'volt' }), envKey: 'VOLT_SOURCE_DIR' },
            { repo: new Repository({ owner: 'voltlabs-research', repo: 'clusterdaemon' }), envKey: 'CLUSTER_DAEMON_SOURCE_DIR' }
        ]
    });

    const deploy = new Deploy({
        composeFile: process.env.VOLT_COMPOSE_FILE ?? path.join(moduleDir, '..', 'stack', 'compose.yml'),
        appConfig,
        sources,
        docker: new DockerPreflight(),
        account: {
            fullName: answers.fullName,
            email: answers.email,
            password: answers.password,
            teamName: answers.teamName,
            clusterName: answers.clusterName
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

    await deploy.start();
    progress.stop();

    const finalEnv = await appConfig.getStackEnv();

    if(consoleReady){
        p.note(
            `VOLT Cloud ID  ${answers.email}\nManage your services at console.voltcloud.dev`,
            'Cloud Services'
        );
    }

    p.note(
        [
            `Client    ${finalEnv.CLIENT_HOST}`,
            `Server    ${finalEnv.SERVER_ENDPOINT}`,
            `Cluster   ${withCluster ? 'daemon running' : 'server only'}`,
            '',
            'Connect from any device:',
            '  Web app      app.voltcloud.dev',
            '  Desktop app  get.voltcloud.dev',
            `  When asked for the server address, enter ${finalEnv.SERVER_ENDPOINT}`
        ].join('\n'),
        'VOLT is up'
    );

    p.outro('Deployment complete.');
};

main().catch((error) => {
    p.log.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
});
