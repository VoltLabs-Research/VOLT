/**
 * Boot-smoke test for the detachable-module resolver.
 *
 * For a handful of `VOLT_MODULES` configurations it calls
 * `resolveEnabledModules` from `@core/bootstrap/module-state` and asserts the
 * invariants that PROVE the toggle behaves: kernel is always present, the
 * `requires`-closure is transitively pulled in, and the resolved set validates.
 *
 * Run:  npm run smoke:modules
 *   (node -r ts-node/register/transpile-only -r tsconfig-paths/register \
 *         scripts/module-boot-smoke.ts)
 *
 * Prints PASS/FAIL per config and exits non-zero if ANY config fails.
 *
 * NOTE: `resolveEnabledModules()` re-reads `process.env.VOLT_MODULES` and
 * re-resolves on EVERY call (only `getEnabledModules()` consults the cache), and
 * the underlying `moduleRegistry` is a process-wide singleton whose `register()`
 * throws on a duplicate key. So we import the module exactly ONCE and simply
 * mutate `VOLT_MODULES` between calls — re-requiring it would re-run manifest
 * registration against the already-populated singleton and throw.
 */

import 'reflect-metadata';
import { resolveEnabledModules } from '@core/bootstrap/module-state';

const KERNEL = ['auth', 'session', 'socket', 'team'] as const;

interface SmokeCase {
    name: string;
    /** `VOLT_MODULES` value, or null to leave it unset (defaults to all). */
    voltModules: string | null;
    /** Keys that MUST be present in the resolved set (closure expectations). */
    expectPresent: string[];
    /** Keys that MUST NOT be present in the resolved set. */
    expectAbsent?: string[];
}

const CASES: SmokeCase[] = [
    {
        name: 'kernel-only',
        voltModules: 'auth,session,socket,team',
        // Kernel has no inter-kernel requires, so the set is exactly the kernel.
        expectPresent: [...KERNEL],
        expectAbsent: ['latex', 'analysis', 'trajectory', 'cluster'],
    },
    {
        name: 'kernel+latex',
        voltModules: 'auth,session,socket,team,latex',
        // latex `requires: ['team']` — team is kernel, so closure adds nothing new,
        // but the leaf itself must survive and validate() must stay ok.
        expectPresent: [...KERNEL, 'latex', 'team'],
        expectAbsent: ['analysis', 'whiteboards', 'chat'],
    },
    {
        name: 'analysis-closure',
        voltModules: 'auth,session,socket,team,analysis',
        // analysis requires trajectory; trajectory requires cluster; cluster
        // requires team. The whole hard-dependency chain must be pulled in.
        expectPresent: [...KERNEL, 'analysis', 'trajectory', 'cluster', 'team'],
    },
    {
        name: 'scripting-closure',
        voltModules: 'auth,session,socket,team,scripting',
        // scripting requires container; container requires cluster + team.
        expectPresent: [...KERNEL, 'scripting', 'container', 'cluster', 'team'],
    },
    {
        name: 'all (default, VOLT_MODULES unset)',
        voltModules: null,
        // No override -> all registered modules enabled.
        expectPresent: [...KERNEL, 'latex', 'analysis', 'trajectory', 'cluster', 'plugin', 'dashboard'],
    },
];

function runCase(testCase: SmokeCase): { ok: boolean; reasons: string[] } {
    const reasons: string[] = [];

    if (testCase.voltModules === null) {
        delete process.env.VOLT_MODULES;
    } else {
        process.env.VOLT_MODULES = testCase.voltModules;
    }

    let enabled: Set<string>;
    try {
        // resolveEnabledModules throws if validate() fails — that is itself a FAIL.
        enabled = resolveEnabledModules();
    } catch (error) {
        return { ok: false, reasons: [`resolveEnabledModules threw: ${(error as Error).message}`] };
    }

    // 1) Kernel is always present.
    for (const kernelKey of KERNEL) {
        if (!enabled.has(kernelKey)) {
            reasons.push(`kernel module "${kernelKey}" missing from resolved set`);
        }
    }

    // 2) requires-closure / explicit presence expectations hold.
    for (const key of testCase.expectPresent) {
        if (!enabled.has(key)) {
            reasons.push(`expected "${key}" to be enabled (closure), but it was absent`);
        }
    }

    // 3) Absence expectations hold.
    for (const key of testCase.expectAbsent ?? []) {
        if (enabled.has(key)) {
            reasons.push(`expected "${key}" to be DISABLED, but it was enabled`);
        }
    }

    return { ok: reasons.length === 0, reasons };
}

function main(): void {
    // eslint-disable-next-line no-console
    console.log('module-boot-smoke: proving the VOLT_MODULES toggle + requires-closure\n');

    let failures = 0;
    for (const testCase of CASES) {
        const voltModulesLabel = testCase.voltModules === null ? '(unset)' : testCase.voltModules;
        const { ok, reasons } = runCase(testCase);
        if (ok) {
            // eslint-disable-next-line no-console
            console.log(`  PASS  ${testCase.name}  [VOLT_MODULES=${voltModulesLabel}]`);
        } else {
            failures += 1;
            // eslint-disable-next-line no-console
            console.log(`  FAIL  ${testCase.name}  [VOLT_MODULES=${voltModulesLabel}]`);
            for (const reason of reasons) {
                // eslint-disable-next-line no-console
                console.log(`          - ${reason}`);
            }
        }
    }

    // eslint-disable-next-line no-console
    console.log(`\n${CASES.length - failures}/${CASES.length} configs passed.`);
    if (failures > 0) {
        process.exit(1);
    }
}

main();
