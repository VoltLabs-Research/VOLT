import type AppConfig from '@/services/AppConfig';
import Repository from '@/services/Repository';
import SourceResolver from '@/services/SourceResolver';

// The GUI (main.ts) and the CLI (cli.ts) resolve the exact same two upstream
// repos; this factory is the single source of that wiring so the two entry
// points cannot drift.
export const createSourceResolver = (appConfig: AppConfig, downloadDir: string): SourceResolver =>
    new SourceResolver({
        appConfig,
        downloadDir,
        repos: [
            { repo: new Repository({ owner: 'voltlabs-research', repo: 'volt' }), envKey: 'VOLT_SOURCE_DIR' },
            { repo: new Repository({ owner: 'voltlabs-research', repo: 'clusterdaemon' }), envKey: 'CLUSTER_DAEMON_SOURCE_DIR' }
        ]
    });
