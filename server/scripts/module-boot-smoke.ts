

import { resolveEnabledModules } from '@core/bootstrap/module-state';

const KERNEL = ['auth', 'session', 'socket', 'team'] as const;

interface SmokeCase {
    name: string;
    
    voltModules: string | null;
    
    expectPresent: string[];
    
    expectAbsent?: string[];
}

const CASES: SmokeCase[] = [
    {
        name: 'kernel-only',
        voltModules: 'auth,session,socket,team',
        
        expectPresent: [...KERNEL],
        expectAbsent: ['latex', 'analysis', 'trajectory', 'cluster'],
    },
    {
        name: 'kernel+latex',
        voltModules: 'auth,session,socket,team,latex',
        
        
        expectPresent: [...KERNEL, 'latex', 'team'],
        expectAbsent: ['analysis', 'whiteboards', 'chat'],
    },
    {
        name: 'analysis-closure',
        voltModules: 'auth,session,socket,team,analysis',
        
        
        expectPresent: [...KERNEL, 'analysis', 'trajectory', 'cluster', 'team'],
    },
    {
        name: 'scripting-closure',
        voltModules: 'auth,session,socket,team,scripting',
        
        expectPresent: [...KERNEL, 'scripting', 'container', 'cluster', 'team'],
    },
    {
        name: 'all (default, VOLT_MODULES unset)',
        voltModules: null,
        
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
        
        enabled = resolveEnabledModules();
    } catch (error) {
        return { ok: false, reasons: [`resolveEnabledModules threw: ${(error as Error).message}`] };
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

    return { ok: reasons.length === 0, reasons };
}

function main(): void {
    
    console.log('module-boot-smoke: proving the VOLT_MODULES toggle + requires-closure\n');

    let failures = 0;
    for (const testCase of CASES) {
        const voltModulesLabel = testCase.voltModules === null ? '(unset)' : testCase.voltModules;
        const { ok, reasons } = runCase(testCase);
        if (ok) {
            
            console.log(`  PASS  ${testCase.name}  [VOLT_MODULES=${voltModulesLabel}]`);
        } else {
            failures += 1;
            
            console.log(`  FAIL  ${testCase.name}  [VOLT_MODULES=${voltModulesLabel}]`);
            for (const reason of reasons) {
                
                console.log(`          - ${reason}`);
            }
        }
    }

    
    console.log(`\n${CASES.length - failures}/${CASES.length} configs passed.`);
    if (failures > 0) {
        process.exit(1);
    }
}

main();
