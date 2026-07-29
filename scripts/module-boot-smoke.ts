import { resolveEnabledModules } from '@core/bootstrap/module-state';

const KERNEL = ['system', 'container'] as const;

interface SmokeCase {
    name: string;
    daemonModules: string | null;
    expectPresent: string[];
    expectAbsent?: string[];
}

const CASES: SmokeCase[] = [
    {
        name: 'kernel-only',
        daemonModules: 'system,container',
        expectPresent: [...KERNEL],
        expectAbsent: ['analysis', 'trajectory', 'plugin', 'jobs', 'notebook']
    },
    {
        name: 'kernel+notebook',
        daemonModules: 'notebook',
        expectPresent: [...KERNEL, 'notebook'],
        expectAbsent: ['analysis', 'trajectory', 'plugin', 'jobs']
    },
    {
        name: 'analysis-closure',
        daemonModules: 'analysis',
        expectPresent: [...KERNEL, 'analysis', 'trajectory', 'plugin', 'jobs'],
        expectAbsent: ['notebook']
    },
    {
        name: 'trajectory-closure',
        daemonModules: 'trajectory',
        expectPresent: [...KERNEL, 'trajectory', 'plugin', 'jobs'],
        expectAbsent: ['analysis', 'notebook']
    },
    {
        name: 'all (default, DAEMON_MODULES unset)',
        daemonModules: null,
        expectPresent: [...KERNEL, 'analysis', 'trajectory', 'plugin', 'jobs', 'notebook']
    }
];

const runCase = (testCase: SmokeCase): { ok: boolean; reasons: string[] } => {
    const reasons: string[] = [];

    if (testCase.daemonModules === null) {
        delete process.env.DAEMON_MODULES;
    } else {
        process.env.DAEMON_MODULES = testCase.daemonModules;
    }

    let enabled: Set<string>;
    try {
        enabled = resolveEnabledModules();
    } catch (error) {
        return {
            ok: false,
            reasons: [`resolveEnabledModules threw: ${(error as Error).message}`]
        };
    }

    for (const kernelKey of KERNEL) {
        if (!enabled.has(kernelKey)) {
            reasons.push(`kernel module "${kernelKey}" missing from resolved set`);
        }
    }

    for (const key of testCase.expectPresent) {
        if (!enabled.has(key)) {
            reasons.push(`expected "${key}" to be enabled (closure), but it was absent`);
        }
    }

    for (const key of testCase.expectAbsent ?? []) {
        if (enabled.has(key)) {
            reasons.push(`expected "${key}" to be DISABLED, but it was enabled`);
        }
    }

    return {
        ok: reasons.length === 0,
        reasons
    };
};

const main = (): void => {
    console.log('module-boot-smoke: proving the DAEMON_MODULES toggle + requires-closure\n');

    let failures = 0;
    for (const testCase of CASES) {
        const label = testCase.daemonModules === null ? '(unset)' : testCase.daemonModules;
        const { ok, reasons } = runCase(testCase);
        if (ok) {
            console.log(`  PASS  ${testCase.name}  [DAEMON_MODULES=${label}]`);
        } else {
            failures += 1;
            console.log(`  FAIL  ${testCase.name}  [DAEMON_MODULES=${label}]`);
            for (const reason of reasons) {
                console.log(`          - ${reason}`);
            }
        }
    }

    console.log(`\n${CASES.length - failures}/${CASES.length} configs passed.`);
    if (failures > 0) {
        process.exit(1);
    }
};

main();
