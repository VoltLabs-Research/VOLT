import os from 'node:os';
import path from 'node:path';

const DEFAULT_DATA_DIR = path.join(os.homedir(), '.volt-daemon', 'data');
const dataDir = process.env.DAEMON_DATA_DIR || DEFAULT_DATA_DIR;

export const DAEMON_PATHS = Object.freeze({
    analysisOutput: path.join(dataDir, 'analysis-output'),
    analysisDumps: path.join(dataDir, 'analysis-dumps'),
    artifactUploads: path.join(dataDir, 'artifact-uploads'),
    pluginBinCache: path.join(dataDir, 'plugin-bin-cache'),
    sshImport: path.join(dataDir, 'ssh-import')
});
