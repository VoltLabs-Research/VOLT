import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
    applyPluginReferenceMappings,
    normalizePluginReferenceMappings,
    readPluginReferenceSelections
} from '../src/plugin-reference';

describe('readPluginReferenceSelections', () => {
    it('reads valid selections and drops invalid ones', () => {
        const selections = readPluginReferenceSelections({
            selections: [
                { pluginId: ' p1 ', config: { a: 1 } },
                { pluginId: '', config: {} },
                { config: {} },
                'garbage'
            ]
        });
        assert.deepEqual(selections, [{ pluginId: 'p1', config: { a: 1 } }]);
    });

    it('returns an empty array for non-objects', () => {
        assert.deepEqual(readPluginReferenceSelections(null), []);
        assert.deepEqual(readPluginReferenceSelections({ selections: 'no' }), []);
    });
});

describe('normalizePluginReferenceMappings', () => {
    it('keeps only mappings with both source and target', () => {
        const mappings = normalizePluginReferenceMappings([
            { sourceArgument: ' src ', targetArgument: ' dst ', targetPluginId: 'pid' },
            { sourceArgument: 'x' },
            undefined as never
        ]);
        assert.deepEqual(mappings, [{ sourceArgument: 'src', targetArgument: 'dst', targetPluginId: 'pid' }]);
    });
});

describe('applyPluginReferenceMappings', () => {
    const definitions = [{ argument: 'crystal', default: 'fcc' }];

    it('copies the resolved source value into the target argument', () => {
        const config = applyPluginReferenceMappings(
            {
                pluginId: 'pid',
                config: { existing: true },
                definition: {
                    argument: 'ref',
                    pluginReferenceMappings: [
                        { sourceArgument: 'crystal', targetArgument: 'reference_topology', targetPluginId: 'pid' }
                    ]
                },
                definitions,
                values: { crystal: 'bcc' }
            }
        );
        assert.deepEqual(config, { existing: true, reference_topology: 'bcc' });
    });

    it('skips mappings targeting a different plugin', () => {
        const config = applyPluginReferenceMappings({
            pluginId: 'other',
            config: {},
            definition: {
                argument: 'ref',
                pluginReferenceMappings: [
                    { sourceArgument: 'crystal', targetArgument: 'reference_topology', targetPluginId: 'pid' }
                ]
            },
            definitions,
            values: { crystal: 'bcc' }
        });
        assert.deepEqual(config, {});
    });

    it('applies valueMap translation when present', () => {
        const config = applyPluginReferenceMappings({
            pluginId: 'pid',
            config: {},
            definition: {
                argument: 'ref',
                pluginReferenceMappings: [
                    {
                        sourceArgument: 'crystal',
                        targetArgument: 'topology',
                        valueMap: { fcc: 'FaceCenteredCubic' }
                    }
                ]
            },
            definitions,
            values: { crystal: 'fcc' }
        });
        assert.deepEqual(config, { topology: 'FaceCenteredCubic' });
    });
});
