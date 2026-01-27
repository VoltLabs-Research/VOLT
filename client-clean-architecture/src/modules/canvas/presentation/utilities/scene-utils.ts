/**
 * Re-export domain services for backward compatibility.
 * New code should import directly from domain/services.
 */
export {
    deepMerge,
    formatSize,
    formatNumber,
    formatPercentage,
    formatDuration
} from '../../domain/services/FormatService';

export {
    computeGlbUrl,
    getSceneSource,
    type SceneSource,
    type ActiveSceneParams,
    type PluginSceneParams,
    type ColorCodingSceneParams,
    type ParticleFilterSceneParams
} from '../../domain/services/UrlBuilderService';
