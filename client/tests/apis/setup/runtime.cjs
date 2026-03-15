const { spawn } = require('node:child_process');
const path = require('node:path');
const supertest = require('supertest');

const SERVER_ROOT = path.resolve(__dirname, '../../../../server');
const DEFAULT_REQUEST_TIMEOUT_MS = 15000;
const DEFAULT_STARTUP_TIMEOUT_MS = 180000;

let runtimeContextPromise;
let managedServerProcess = null;
let managedServerLogs = [];

const getNumberEnv = (name, fallbackValue) => {
    const rawValue = process.env[name];
    if (!rawValue) {
        return fallbackValue;
    }

    const parsedValue = Number(rawValue);
    if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
        return fallbackValue;
    }

    return parsedValue;
};

const getApiTestConfig = () => {
    return {
        baseUrl: process.env.API_TEST_BASE_URL || null,
        requestTimeoutMs: getNumberEnv('API_TEST_REQUEST_TIMEOUT_MS', DEFAULT_REQUEST_TIMEOUT_MS),
        startupTimeoutMs: getNumberEnv('API_TEST_SERVER_STARTUP_TIMEOUT_MS', DEFAULT_STARTUP_TIMEOUT_MS)
    };
};

const rememberServerLogChunk = (chunk) => {
    const serializedChunk = String(chunk).trim();
    if (!serializedChunk) {
        return;
    }

    managedServerLogs.push(serializedChunk);
    managedServerLogs = managedServerLogs.slice(-50);
};

const getRequester = (baseUrl) => {
    return supertest(baseUrl);
};

const isSuccessfulReadinessStatus = (statusCode) => {
    return statusCode >= 200 && statusCode < 500;
};

const wait = (ms) => {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
};

const waitForServerReadiness = async (baseUrl, timeoutMs) => {
    const deadline = Date.now() + timeoutMs;
    const requester = getRequester(baseUrl);
    let lastError = null;

    while (Date.now() < deadline) {
        try {
            const response = await requester
                .get('/api/auth/guest-identity')
                .query({ seed: 'api-test-readiness' })
                .timeout({
                    response: 5000,
                    deadline: 5000
                });

            if (isSuccessfulReadinessStatus(response.statusCode)) {
                return;
            }

            lastError = new Error(`Unexpected readiness status: ${response.statusCode}`);
        } catch (error) {
            lastError = error;
        }

        await wait(1000);
    }

    const recentLogs = managedServerLogs.join('\n');
    const errorMessage = lastError instanceof Error ? lastError.message : String(lastError);
    throw new Error(`Managed API server did not become ready in time. Last error: ${errorMessage}\n${recentLogs}`);
};

const startManagedServer = async (config) => {
    managedServerLogs = [];

    managedServerProcess = spawn('npm', ['run', 'start'], {
        cwd: SERVER_ROOT,
        env: {
            ...process.env,
            FORCE_COLOR: '0'
        },
        stdio: ['ignore', 'pipe', 'pipe']
    });

    managedServerProcess.stdout.on('data', rememberServerLogChunk);
    managedServerProcess.stderr.on('data', rememberServerLogChunk);

    const exitPromise = new Promise((_, reject) => {
        managedServerProcess.once('exit', (code, signal) => {
            reject(new Error(`Managed API server exited early with code=${String(code)} signal=${String(signal)}\n${managedServerLogs.join('\n')}`));
        });
    });

    const readinessPromise = waitForServerReadiness('http://127.0.0.1:8000', config.startupTimeoutMs);

    await Promise.race([readinessPromise, exitPromise]);

    return {
        baseUrl: 'http://127.0.0.1:8000',
        managedServer: true
    };
};

const createRuntimeContext = async () => {
    const config = getApiTestConfig();

    if (config.baseUrl) {
        await waitForServerReadiness(config.baseUrl, config.startupTimeoutMs);
        return {
            ...config,
            baseUrl: config.baseUrl,
            managedServer: false,
            requester: getRequester(config.baseUrl)
        };
    }

    const managedServerContext = await startManagedServer(config);
    return {
        ...config,
        ...managedServerContext,
        requester: getRequester(managedServerContext.baseUrl)
    };
};

const getRuntimeContext = async () => {
    if (!runtimeContextPromise) {
        runtimeContextPromise = createRuntimeContext();
    }

    return runtimeContextPromise;
};

const stopRuntimeContext = async () => {
    if (!managedServerProcess) {
        return;
    }

    const processToStop = managedServerProcess;
    managedServerProcess = null;

    await new Promise((resolve) => {
        processToStop.once('exit', resolve);
        processToStop.kill('SIGTERM');

        setTimeout(() => {
            processToStop.kill('SIGKILL');
            resolve();
        }, 5000);
    });
};

module.exports = {
    getApiTestConfig,
    getRuntimeContext,
    stopRuntimeContext
};
