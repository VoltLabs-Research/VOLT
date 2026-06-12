import { defineModule } from '@shared/infrastructure/modules/defineModule';

/**
 * Detachable-module manifest for `whiteboards` (collaborative Excalidraw-style
 * boards). Leaf feature: safe to disable. Hard-requires team (kernel); degrades
 * gracefully without ai/cluster/container/socket.
 */
export default defineModule({
    key: 'whiteboards',
    tier: 'leaf',
    requires: ['team'],
    optional: ['ai', 'cluster', 'container', 'socket'],
    description: 'Collaborative whiteboards'
});
