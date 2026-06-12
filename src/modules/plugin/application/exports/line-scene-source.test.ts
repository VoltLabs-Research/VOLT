import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildLineRangesSidecarKey } from '@/modules/plugin/application/exports/line-scene-source';

describe('buildLineRangesSidecarKey', () => {
    it('keys the sidecar to the logical GLB for baked exports (pre-compression key)', () => {
        assert.equal(
            buildLineRangesSidecarKey('trajectory-t/analysis-a/glb/0/exposure.glb'),
            'trajectory-t/analysis-a/glb/0/exposure.glb.ranges.json'
        );
    });

    it('strips the storage encoding for styled exports (stored .zst key)', () => {
        assert.equal(
            buildLineRangesSidecarKey('trajectory-t/analysis-a/glb/0/line-style/e/hash.glb.zst'),
            'trajectory-t/analysis-a/glb/0/line-style/e/hash.glb.ranges.json'
        );
    });
});
