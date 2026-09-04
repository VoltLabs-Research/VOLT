import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

export interface StackRuntimeManifest{
    builtAt: string;
    platform: string;
    arch: string;
    node: string;
    nodeBinary: string;
    server: { version: string; entry: string };
    daemon: { version: string; entry: string };
    client: { version: string; dir: string };
}

export interface StackRuntimeLayout{
    root: string;
    manifest: StackRuntimeManifest;
    nodeBinary: string;
    serverDir: string;
    serverEntry: string;
    daemonDir: string;
    daemonEntry: string;
    clientDir: string;
}

const exists = (target: string): Promise<boolean> => access(target).then(() => true, () => false);

export const stackRuntimeHint = (root: string): string =>
    `No packaged Volt stack at ${root}. Run "npm run stack:build" in desktop/ (or point dev mode at a VOLT checkout whose desktop/stack-runtime is built).`;

export const resolveStackRuntime = async (root: string): Promise<StackRuntimeLayout> => {
    const manifestPath = path.join(root, 'manifest.json');
    if(!await exists(manifestPath)) throw new Error(stackRuntimeHint(root));

    const manifest = JSON.parse(await readFile(manifestPath, 'utf-8')) as StackRuntimeManifest;
    const layout: StackRuntimeLayout = {
        root,
        manifest,
        nodeBinary: path.join(root, manifest.nodeBinary),
        serverDir: path.join(root, 'server'),
        serverEntry: path.join(root, manifest.server.entry),
        daemonDir: path.join(root, 'daemon'),
        daemonEntry: path.join(root, manifest.daemon.entry),
        clientDir: path.join(root, manifest.client.dir)
    };

    for(const required of [layout.nodeBinary, layout.serverEntry, layout.daemonEntry, path.join(layout.clientDir, 'index.html')]){
        if(!await exists(required)) throw new Error(`Packaged Volt stack at ${root} is incomplete: missing ${path.relative(root, required)}`);
    }

    return layout;
};

export const runtimeRootForCheckout = (voltPath: string): string => path.join(voltPath, 'desktop', 'stack-runtime');
