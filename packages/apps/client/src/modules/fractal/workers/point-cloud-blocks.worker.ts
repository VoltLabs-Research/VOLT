import { buildPointCloudBlocks } from '@/modules/fractal/services/point-cloud-blocks';

interface BlocksRequest {
    id: number;
    positions: Float32Array;
}

self.onmessage = (event: MessageEvent<BlocksRequest>) => {
    const { id, positions } = event.data;
    const blocks = buildPointCloudBlocks(positions);
    self.postMessage({ id, blocks }, {
        transfer: [blocks.index.buffer, blocks.starts.buffer, blocks.counts.buffer, blocks.spheres.buffer]
    });
};
