import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { EntrypointNodeType } from '@modules/plugin/domain/entities/plugin/workflow/nodes/EntrypointNode';
import { WorkflowNodeType } from '@modules/plugin/domain/entities/plugin/workflow/WorkflowNode';
import { WorkflowValidationMode } from '@modules/plugin/domain/port/plugin/IWorkflowValidatorService';
import { WorkflowValidatorService } from './WorkflowValidatorService';

const buildWorkflow = (entrypointOverrides: Record<string, unknown> = {}) => ({
    nodes: [
        {
            id: 'modifier',
            type: WorkflowNodeType.Modifier,
            position: { x: 0, y: 0 },
            data: {
                modifier: {
                    name: 'Plugin Name'
                }
            }
        },
        {
            id: 'for-each',
            type: WorkflowNodeType.ForEach,
            position: { x: 120, y: 0 },
            data: {
                forEach: {
                    iterableSource: 'trajectory.frames'
                }
            }
        },
        {
            id: 'entrypoint',
            type: WorkflowNodeType.Entrypoint,
            position: { x: 240, y: 0 },
            data: {
                entrypoint: {
                    type: EntrypointNodeType.Executable,
                    arguments: '',
                    ...entrypointOverrides
                }
            }
        }
    ],
    edges: [{
        id: 'edge-1',
        source: 'for-each',
        target: 'entrypoint'
    }]
});

class StubPluginDependencyResolverService {
    async collectTransitivePublishedDependencies() {
        return {
            dependencies: [],
            errors: []
        };
    }
}

test('WorkflowValidatorService allows draft plugins without an uploaded runtime binary', async () => {
    const validator = new WorkflowValidatorService(
        new StubPluginDependencyResolverService() as any
    );

    const result = await validator.validate(
        buildWorkflow(),
        'plugin-1',
        WorkflowValidationMode.Draft
    );

    assert.equal(result.isValid, true);
});

test('WorkflowValidatorService rejects published plugins without runtime-ready entrypoint data', async () => {
    const validator = new WorkflowValidatorService(
        new StubPluginDependencyResolverService() as any
    );

    const result = await validator.validate(
        buildWorkflow({
            type: EntrypointNodeType.PythonScript
        }),
        'plugin-1',
        WorkflowValidationMode.Strict
    );

    assert.equal(result.isValid, false);
    assert.deepEqual(result.errors, [
        'Top-level entrypoint entrypoint requires an uploaded binary',
        'Top-level entrypoint entrypoint must define execution arguments',
        'Top-level entrypoint entrypoint must define an entrypoint script'
    ]);
});
