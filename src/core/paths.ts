import path from 'node:path';

export const DAEMON_PATHS = Object.freeze({
    analysisOutput: '/tmp/analysis-output',
    analysisDumps: '/tmp/analysis-dumps',
    pluginBinCache: '/tmp/plugin-bin-cache',
    sshImport: '/tmp/ssh-import',
    scriptingImageContext: path.resolve(process.cwd(), 'image-contexts/scripting')
});
