import { humanizeKey } from '../components/AnalysisTreeNode/config-values';
import { resolveRunLabel } from '../components/PipelineRunTreeNode/stage-labels';

import type { Analysis } from '@volt/contracts/modules/analysis/domain';
import type { PipelineRun } from '@volt/contracts/modules/plugin/pipeline-run';
import type { RenderableExposure } from '@/modules/plugin/hooks/plugin/use-plugin-selectors';
import type { SceneObjectType } from '@/modules/fractal/contracts/scene';

interface BuildScreenshotFilenameParams {
    scenes: SceneObjectType[];
    analyses: Analysis[];
    pipelineRuns: PipelineRun[];
    exposuresByAnalysisId: Map<string, RenderableExposure[]>;
    timestep?: number;
}

const TRAJECTORY_ARTIFACT = 'Atoms';

const sanitizeFilenamePart = (value: string, fallback: string): string => {
    const stem = value
        .replace(/[^A-Za-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80);

    return stem || fallback;
};

const formatTimestep = (timestep: number | undefined): string => {
    if (timestep === undefined || !Number.isFinite(timestep)) {
        return 'T-unknown';
    }

    return `T-${Math.trunc(timestep)}`;
};

const resolvePipelineName = (
    scenes: SceneObjectType[],
    analyses: Analysis[],
    pipelineRuns: PipelineRun[]
): string => {
    const analysisIds = new Set(
        scenes.flatMap((scene) => (scene.source === 'plugin' && scene.analysisId ? [scene.analysisId] : []))
    );
    const matchedAnalyses = analyses.filter((analysis) => analysisIds.has(analysis._id));
    const runId = matchedAnalyses.find((analysis) => analysis.pipelineRunId)?.pipelineRunId;
    const run = runId
        ? pipelineRuns.find((candidate) => candidate._id === runId)
        : pipelineRuns[0];

    if (run) {
        return resolveRunLabel(run, run.stages.map((stage) => ({
            kind: 'analysis',
            stage
        })));
    }

    const pluginName = matchedAnalyses[0]?.pluginDisplayName;
    if (pluginName) {
        return pluginName;
    }

    return 'Scene';
};

const resolveSceneArtifactName = (
    scene: SceneObjectType,
    analyses: Analysis[],
    exposuresByAnalysisId: Map<string, RenderableExposure[]>
): string | undefined => {
    if (scene.source === 'default') {
        return TRAJECTORY_ARTIFACT;
    }

    if (scene.source === 'color-coding') {
        return scene.property ? `Color ${humanizeKey(scene.property)}` : 'Color Coding';
    }

    if (scene.source === 'particle-filter') {
        return scene.property ? `Filter ${humanizeKey(scene.property)}` : 'Particle Filter';
    }

    const analysis = analyses.find((candidate) => candidate._id === scene.analysisId);
    const exposure = exposuresByAnalysisId
        .get(scene.analysisId)
        ?.find((candidate) => candidate.exposureId === scene.exposureId);
    const artifact = analysis?.expectedArtifacts?.find((candidate) => candidate.exposureId === scene.exposureId);

    return exposure?.name || artifact?.name || humanizeKey(scene.exposureId);
};

const resolveArtifactNames = (
    scenes: SceneObjectType[],
    analyses: Analysis[],
    exposuresByAnalysisId: Map<string, RenderableExposure[]>
): string[] => {
    const names = scenes.flatMap((scene) => {
        const name = resolveSceneArtifactName(scene, analyses, exposuresByAnalysisId);
        return name ? [name] : [];
    });

    return [...new Set(names)];
};

export const buildScreenshotFilename = ({
    scenes,
    analyses,
    pipelineRuns,
    exposuresByAnalysisId,
    timestep
}: BuildScreenshotFilenameParams): string => {
    const pipelineName = sanitizeFilenamePart(resolvePipelineName(scenes, analyses, pipelineRuns), 'scene');
    const artifacts = resolveArtifactNames(scenes, analyses, exposuresByAnalysisId)
        .map((name) => sanitizeFilenamePart(name, 'artifact'));
    const artifactPart = artifacts.length > 0 ? artifacts.join('-') : 'scene';

    return `${pipelineName}_${formatTimestep(timestep)}_-${artifactPart}.png`;
};
