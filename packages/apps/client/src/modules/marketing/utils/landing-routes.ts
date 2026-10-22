import { LANDING_ACTIVITY, LANDING_CLUSTER, LANDING_MEMBERS, LANDING_NOTIFICATIONS, LANDING_TEAM, LANDING_TEAM_ID, LANDING_USER } from '@/modules/marketing/utils/landing-workspace';
import {
    LANDING_AI_INTEGRATION,
    LANDING_AI_MODEL,
    LANDING_AI_PROVIDERS,
    LANDING_CONVERSATIONS,
    LANDING_CONVERSATION_ID,
    LANDING_MESSAGES
} from '@/modules/marketing/utils/landing-conversation';
import { PLAYS_CONVERSATION } from '@/modules/marketing/utils/landing-assistant';
import {
    LANDING_FOLDERS,
    LANDING_SIMULATION_CELLS,
    LANDING_TRAJECTORY_LIST,
    SAMPLE_TIMESTEPS,
    SHEAR_DEFORMATION,
    SHEAR_DEFORMATION_ID,
    shearDeformationBootstrap
} from '@/modules/marketing/utils/landing-trajectories';
import type { ScreenRequest, ScreenRoute } from '@/modules/marketing/utils/screen-server';
import {
    COORDINATION_ANALYSIS,
    COORDINATION_ANALYSIS_ID,
    COORDINATION_LISTING,
    COORDINATION_MODEL_EXPOSURE_ID,
    COORDINATION_PLUGIN,
    COORDINATION_PLUGIN_ID,
    COORDINATION_PRIMARY_EXPOSURE_ID,
    COORDINATION_RENDERABLE_EXPOSURES,
    COORDINATION_RUN
} from '@/modules/marketing/utils/landing-coordination';
import { searchRegistry } from '@/modules/marketing/utils/landing-registry';

const PREVIEW = '/samples/shear-deformation-preview.png';
// The models the server serves for the sample's frames, saved as it answered them, and the one
// Coordination Analysis exports for its first.
const frameModel = (timestep: string) => `/samples/shear-deformation-${timestep}.glb`;
const COORDINATION_MODEL_TIMESTEP = '75000';
const COORDINATION_MODEL = '/samples/shear-deformation-coordination-75000.glb';

// The server's envelopes.
const ok = (data: unknown) => ({ status: 'success', data });

const page = (items: unknown[], { query }: ScreenRequest) => {
    const limit = Number(query.get('limit') ?? items.length) || items.length;
    return {
        status: 'success',
        data: items,
        pagination: { page: 1, limit, total: items.length, totalPages: items.length ? 1 : 0, hasMore: false }
    };
};

// The plugin catalogue pages in an envelope of its own.
const catalogPage = (items: unknown[], { query }: ScreenRequest) => ok({
    data: items,
    total: items.length,
    page: 1,
    limit: Number(query.get('limit') ?? items.length),
    totalPages: items.length ? 1 : 0
});

const bytes = (path: string) => fetch(path).then((response) => response.arrayBuffer());

const dataUrl = (path: string) => fetch(path)
    .then((response) => response.blob())
    .then((blob) => new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.readAsDataURL(blob);
    }));

const forSample = <T>(answer: (request: ScreenRequest) => T) => (request: ScreenRequest) => (
    request.params.trajectoryId === SHEAR_DEFORMATION_ID ? answer(request) : undefined
);

const coordinationModel = ({ params }: ScreenRequest) => (
    params.analysisId === COORDINATION_ANALYSIS_ID
    && params.exposureId === COORDINATION_MODEL_EXPOSURE_ID
    && params.timestep === COORDINATION_MODEL_TIMESTEP
        ? bytes(COORDINATION_MODEL)
        : undefined
);

const sceneArtifacts = (request: ScreenRequest) => {
    const { query } = request;
    const isAnalysisModel = query.get('sourceType') === 'plugin-exposure' && query.get('analysisId') === COORDINATION_ANALYSIS_ID;
    return page(isAnalysisModel ? COORDINATION_RENDERABLE_EXPOSURES : [], request);
};

const AI_MODELS = {
    teamId: LANDING_TEAM_ID,
    providers: [{
        provider: LANDING_AI_INTEGRATION.provider,
        providerName: LANDING_AI_INTEGRATION.providerName,
        defaultModel: LANDING_AI_MODEL.id,
        models: [LANDING_AI_MODEL]
    }],
    models: [{
        ...LANDING_AI_MODEL,
        provider: LANDING_AI_INTEGRATION.provider,
        providerName: LANDING_AI_INTEGRATION.providerName,
        isDefault: true
    }]
};

export const LANDING_ROUTES: ScreenRoute[] = [
    ['GET', '/system/config', () => ok({ mode: 'cloud' })],
    ['GET', '/auth/me', () => ok(LANDING_USER)],
    ['GET', '/teams', () => ok([LANDING_TEAM])],
    ['GET', '/teams/:teamId/self/permissions', () => ok({ permissions: ['*'] })],
    ['GET', '/teams/:teamId/clusters', (request) => page([LANDING_CLUSTER], request)],
    ['GET', '/teams/:teamId/members', (request) => page(LANDING_MEMBERS, request)],
    ['GET', '/teams/:teamId/daily-activities', () => ok(LANDING_ACTIVITY)],
    ['GET', '/notifications', (request) => page(LANDING_NOTIFICATIONS, request)],
    ['GET', '/teams/:teamId/plugins', (request) => catalogPage([COORDINATION_PLUGIN], request)],
    ['GET', '/teams/:teamId/plugins/registry/search', ({ query }) => {
        const items = searchRegistry(query.get('q') ?? '');
        return ok({ items, page: 1, pageSize: Number(query.get('limit') ?? items.length), total: items.length });
    }],
    ['GET', '/teams/:teamId/plugins/:pluginId', ({ params }) => (
        params.pluginId === COORDINATION_PLUGIN_ID ? ok(COORDINATION_PLUGIN) : undefined
    )],
    ['GET', '/teams/:teamId/plugins/:pluginId/listings', ({ params, query }) => (
        params.pluginId === COORDINATION_PLUGIN_ID
        && query.get('analysisId') === COORDINATION_ANALYSIS_ID
        && query.get('exposureId') === COORDINATION_PRIMARY_EXPOSURE_ID
            ? ok(COORDINATION_LISTING)
            : undefined
    )],

    ['GET', '/teams/:teamId/ai-integrations', () => ok({ teamId: LANDING_TEAM_ID, integrations: [LANDING_AI_INTEGRATION], providers: LANDING_AI_PROVIDERS })],
    ['GET', '/teams/:teamId/ai-integrations/models', () => ok(AI_MODELS)],
    ['GET', '/teams/:teamId/ai-conversations', (request) => page(LANDING_CONVERSATIONS, request)],
    ['GET', '/teams/:teamId/ai-conversations/:conversationId', ({ params }) => {
        const conversation = LANDING_CONVERSATIONS.find((listed) => listed._id === params.conversationId);
        return conversation ? ok(conversation) : undefined;
    }],
    // The conversation starts empty for the visitor to watch it play, unless they asked for less
    // motion. Its turns go over the socket the screen holds (landing-assistant).
    ['GET', '/teams/:teamId/ai-conversations/:conversationId/messages', (request) => (
        request.params.conversationId === LANDING_CONVERSATION_ID ? page(PLAYS_CONVERSATION ? [] : LANDING_MESSAGES, request) : undefined
    )],

    ['GET', '/teams/:teamId/trajectories', (request) => page(LANDING_TRAJECTORY_LIST, request)],
    ['GET', '/teams/:teamId/trajectory-folders', (request) => page(LANDING_FOLDERS, request)],
    ['GET', '/teams/:teamId/trajectories/:trajectoryId/preview', forSample(() => dataUrl(PREVIEW).then(ok))],

    ['GET', '/public/trajectories/:trajectoryId/bootstrap', forSample(() => ok(shearDeformationBootstrap([COORDINATION_ANALYSIS_ID])))],
    ['GET', '/public/trajectories/:trajectoryId', forSample(() => ok(SHEAR_DEFORMATION))],
    ['GET', '/public/trajectories/:trajectoryId/analyses', forSample((request) => page([COORDINATION_ANALYSIS], request))],
    ['GET', '/public/trajectories/:trajectoryId/frames/:timestep/glb', forSample(({ params }) => (
        SAMPLE_TIMESTEPS.includes(Number(params.timestep)) ? bytes(frameModel(params.timestep)) : undefined
    ))],
    ['GET', '/public/trajectories/:trajectoryId/exposures/:analysisId/:exposureId/:timestep/glb', forSample(coordinationModel)],
    ['GET', '/teams/:teamId/plugins/exposures/:trajectoryId/:analysisId/:exposureId/:timestep/glb', forSample(coordinationModel)],
    ['GET', '/teams/:teamId/analyses', (request) => (
        request.query.get('trajectoryId') === SHEAR_DEFORMATION_ID ? page([COORDINATION_ANALYSIS], request) : page([], request)
    )],
    ['GET', '/teams/:teamId/plugins/trajectories/:trajectoryId/pipeline-runs', forSample((request) => catalogPage([COORDINATION_RUN], request))],
    ['GET', '/teams/:teamId/trajectories/:trajectoryId/scene-artifacts', forSample(sceneArtifacts)],
    // The dump's columns, and what the analysis adds to each atom.
    ['GET', '/teams/:teamId/trajectories/:trajectoryId/color-codings/properties', forSample(({ query }) => ok({
        base: ['id', 'type', 'x', 'y', 'z'],
        modifiers: query.get('analysisId') === COORDINATION_ANALYSIS_ID ? { [COORDINATION_MODEL_EXPOSURE_ID]: ['coordination'] } : {},
        modifierTypes: query.get('analysisId') === COORDINATION_ANALYSIS_ID ? { [COORDINATION_MODEL_EXPOSURE_ID]: { coordination: 'number' } } : {}
    }))],
    ['GET', '/teams/:teamId/trajectories/:trajectoryId/simulation-cell', forSample(({ query }) => ok(
        LANDING_SIMULATION_CELLS.find((cell) => cell.timestep === Number(query.get('timestep'))) ?? null
    ))]
];
