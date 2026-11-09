

export interface RbacEntry{
    key: string;
    label: string;
}

export interface RbacConfig{
    resources: RbacEntry[];
    actions: RbacEntry[];
}

export interface SystemConfig{
    mode: 'local' | 'cloud';
}

// A VOLT release as published on GitHub. Only `v*` tags are VOLT releases; the repository also
// publishes other products' releases.
export interface VoltRelease{
    version: string;
    url: string;
}

// The desktop app's own update, which electron-updater downloads in the background. Where the
// platform cannot update itself (macOS, .deb, .rpm), `manual` points at the release to download.
export type DesktopUpdateState =
    | { status: 'idle' }
    | { status: 'downloading'; version: string; percent: number }
    | { status: 'ready'; version: string }
    | { status: 'manual'; version: string; url: string };

// A self-hosted server's update, which also updates the clusters installed on other machines.
export interface SystemUpdateStatus{
    // The release this server runs, or null where it does not know (a development build).
    currentVersion: string | null;
    latest: VoltRelease | null;
    updateAvailable: boolean;
    // Whether this server can update itself (deployed with deploy.sh) and this user may do it.
    canApply: boolean;
    // From the moment an update is requested until the server comes back on the new version.
    applying: boolean;
    // Why the last update request failed, if it did.
    error: string | null;
    // Clusters on other machines that still run another release than this server.
    clustersBehind: number;
}

// The payload of the daemon's runtime.update command. The daemon fetches its install manifest
// with its own credentials, so the server only tells it which release to move to and the ports
// its install was made with.
export interface DaemonRuntimeUpdatePayload{
    version: string;
    ports: {
        postgres: number;
        daemon: number;
    };
}
