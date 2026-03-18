import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPropertyOptions, resolvePropertySelection } from './use-property-selector.utilities';

import type { FilterPropertiesData } from '../../api/dtos/particle-filter';

test('buildPropertyOptions disambiguates duplicate plugin properties and preserves exposure-aware selection', () => {
    const properties: FilterPropertiesData = {
        dump: ['type'],
        perAtom: {
            'exposure-a': ['charge'],
            'exposure-b': ['charge']
        },
        exposureNames: {
            'exposure-a': 'Shared Exposure',
            'exposure-b': 'Shared Exposure'
        }
    };

    const options = buildPropertyOptions(properties);

    assert.deepEqual(options.map((option) => option.title), [
        'type',
        'charge (Shared Exposure - exposure-a)',
        'charge (Shared Exposure - exposure-b)'
    ]);

    assert.deepEqual(
        resolvePropertySelection(options, 'plugin:exposure-a:charge'),
        { property: 'charge', exposureId: 'exposure-a' }
    );

    assert.deepEqual(
        resolvePropertySelection(options, 'plugin:exposure-b:charge'),
        { property: 'charge', exposureId: 'exposure-b' }
    );

    assert.deepEqual(
        resolvePropertySelection(options, 'dump:type'),
        { property: 'type', exposureId: null }
    );
});
