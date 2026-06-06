import { existsSync } from 'node:fs';
import path from 'node:path';

// The compose build contexts read these subpaths; fail fast with a readable
// message instead of letting `docker compose` choke on a missing/relative
// context. compose resolves a relative context against the compose file's dir
// (not our cwd), so only absolute paths are safe — and the native picker always
// returns them. Shared so both the IPC apply handler and Deploy's per-launch
// resolution surface the same error.
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
