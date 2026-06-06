import { existsSync } from 'node:fs';
import path from 'node:path';

export const assertDevPaths = (voltPath: string, clusterDaemonPath: string) => {
    for(const [label, dir] of [['VOLT', voltPath], ['ClusterDaemon', clusterDaemonPath]] as const){
        if(!path.isAbsolute(dir)) throw new Error(`${label} path must be absolute (got ${dir || 'empty'})`);
    }

    const checks: [string, string][] = [
        [path.join(voltPath, 'server', 'Dockerfile.dev'), `VOLT path must contain server/Dockerfile.dev (got ${voltPath})`],
        [path.join(voltPath, 'client'), `VOLT path must contain a client/ directory (got ${voltPath})`],
        [path.join(clusterDaemonPath, 'Dockerfile.dev'), `ClusterDaemon path must contain Dockerfile.dev (got ${clusterDaemonPath})`]
    ];

    for(const [target, message] of checks){
        if(!existsSync(target)) throw new Error(message);
    }
};
