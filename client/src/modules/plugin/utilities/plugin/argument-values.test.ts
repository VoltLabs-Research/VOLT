import assert from 'node:assert/strict';
import test from 'node:test';

import type { IArgumentDefinition } from '@/modules/plugin/api/entities/plugin/workflow';
import { ArgumentType } from '@/modules/plugin/api/entities/plugin/workflow-enums';

import {
    coerceArgumentInputValue,
    getPrimitiveArgumentFieldValue,
    resolveArgumentRuntimeValue
} from './argument-values';

const buildNumberArgument = (): IArgumentDefinition => ({
    argument: 'threshold',
    type: ArgumentType.NUMBER,
    label: 'Threshold'
});

test('number arguments preserve intermediate decimal strings in the field', () => {
    const argument = buildNumberArgument();

    assert.equal(coerceArgumentInputValue(argument, '0.05'), '0.05');
    assert.equal(getPrimitiveArgumentFieldValue(argument, '0.0'), '0.0');
    assert.equal(getPrimitiveArgumentFieldValue(argument, '0.05'), '0.05');
});

test('number arguments normalize to numeric values at execution time', () => {
    const argument = buildNumberArgument();

    assert.equal(resolveArgumentRuntimeValue(argument, '0.05'), 0.05);
    assert.equal(resolveArgumentRuntimeValue(argument, '0.0'), 0);
    assert.equal(resolveArgumentRuntimeValue(argument, 3), 3);
});

test('list arguments normalize nested number values at execution time', () => {
    const argument: IArgumentDefinition = {
        argument: 'points',
        type: ArgumentType.LIST,
        label: 'Points',
        listArguments: [
            {
                argument: 'value',
                type: ArgumentType.NUMBER,
                label: 'Value'
            }
        ]
    };

    assert.deepEqual(resolveArgumentRuntimeValue(argument, [{ value: '0.05' }, { value: '1.25' }]), [
        { value: 0.05 },
        { value: 1.25 }
    ]);
});
