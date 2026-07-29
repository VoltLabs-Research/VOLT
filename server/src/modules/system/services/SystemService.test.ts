import '@tests/test-env';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { Action } from '@core/constants/permissions';
import { Resource } from '@core/constants/resources';
import { getEnabledModules } from '@core/bootstrap/module-state';
import SystemService from '@modules/system/services/SystemService';

describe('SystemService', () => {
    const service = new SystemService();
    const originalDeploymentMode = process.env.DEPLOYMENT_MODE;

    afterEach(() => {
        if(originalDeploymentMode === undefined){
            delete process.env.DEPLOYMENT_MODE;
            return;
        }
        process.env.DEPLOYMENT_MODE = originalDeploymentMode;
    });

    describe('getRbac', () => {
        it('lists every resource of the catalog once', () => {
            const { resources } = service.getRbac();

            assert.deepEqual(resources.map(({ key }) => key), Object.values(Resource));
        });

        it('lists every action of the catalog once', () => {
            const { actions } = service.getRbac();

            assert.deepEqual(actions.map(({ key }) => key), Object.values(Action));
        });

        it('turns a single word enum name into a capitalized label', () => {
            const { actions } = service.getRbac();

            assert.deepEqual(
                actions.find(({ key }) => key === Action.READ),
                {
                    key: 'read',
                    label: 'Read'
                }
            );
        });

        it('turns an underscored enum name into capitalized words', () => {
            const { resources } = service.getRbac();

            assert.deepEqual(
                resources.find(({ key }) => key === Resource.DAILY_ACTIVITY),
                {
                    key: 'daily-activity',
                    label: 'Daily Activity'
                }
            );
        });

        it('keeps the resource key untouched when it carries a dash', () => {
            const { resources } = service.getRbac();

            assert.deepEqual(
                resources.find(({ key }) => key === Resource.SIMULATION_CELL),
                {
                    key: 'simulation-cell',
                    label: 'Simulation Cell'
                }
            );
        });

        it('lower cases the tail of an acronym enum name', () => {
            const { resources } = service.getRbac();

            assert.deepEqual(
                resources.find(({ key }) => key === Resource.AI_CONVERSATION),
                {
                    key: 'ai-conversation',
                    label: 'Ai Conversation'
                }
            );
        });
    });

    describe('getConfig', () => {
        it('reports the cloud deployment mode when DEPLOYMENT_MODE is not local', () => {
            assert.equal(service.getConfig().mode, 'cloud');
        });

        it('ignores a deployment mode that changes after the module was loaded', () => {
            process.env.DEPLOYMENT_MODE = 'local';

            assert.equal(service.getConfig().mode, 'cloud');
        });

        it('answers with the enabled modules sorted by key', () => {
            const { enabledModules } = service.getConfig();

            assert.deepEqual(enabledModules, [...enabledModules].sort());
            assert.deepEqual(enabledModules, [...getEnabledModules()].sort());
        });

        it('always enables the kernel modules', () => {
            const { enabledModules } = service.getConfig();

            for(const kernelModule of ['auth', 'session', 'socket', 'team', 'system']){
                assert.ok(enabledModules.includes(kernelModule), `${kernelModule} is not enabled`);
            }
        });

        it('answers with a fresh list on every call', () => {
            const first = service.getConfig().enabledModules;
            first.push('tampered');

            assert.equal(service.getConfig().enabledModules.includes('tampered'), false);
        });
    });
});
