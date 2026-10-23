// Stack smoke page: brings up the browser's local stack as the web client does (server, provisioning,
// daemon, default plugins) and checks the server sees the provisioned cluster connected.
import { startBrowserStack } from '../src/host/browser-stack';
import { BrowserStackStore } from '../src/host/browser-stack-store';

const report = (step: string, value: unknown): void => console.log(`SMOKE ${step} ${JSON.stringify(value)}`);

const run = async (): Promise<void> => {
    const { state, plugins } = await startBrowserStack({
        runtimeUrl: new URL('../', import.meta.url),
        clientOrigin: location.origin,
        store: new BrowserStackStore('volt-smoke-stack.json'),
        storagePrefix: 'volt-smoke-stack',
        phase: async (id, phaseRun) => {
            const result = await phaseRun();
            report(id, 'done');
            return result;
        }
    });
    report('cluster', { teamId: state.teamId, teamClusterId: state.teamClusterId });
    await plugins;
    report('done', true);
};

run().catch((error: Error) => report('error', error.stack ?? error.message));
