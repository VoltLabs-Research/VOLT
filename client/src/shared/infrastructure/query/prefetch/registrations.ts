/**
 * Central file that registers all module-level prefetch factories.
 * Imported once in the dashboard layout so all sidebar hover-prefetch
 * targets are available before the sidebar renders.
 *
 * Each call to `registerPrefetch` maps a sidebar route to a factory
 * that returns the query options to prefetch on hover.
 */
import { containerQuery } from '@/modules/container/hooks/queries';
import { latexDocumentsQuery } from '@/modules/latex/hooks/queries';
import { whiteboardsQuery } from '@/modules/whiteboards/hooks/queries';
import { trajectoryQuery, trajectorySamplesQuery } from '@/modules/trajectory/hooks/trajectory/queries';
import { analysisQuery } from '@/modules/analysis/hooks/queries';
import { sshConnectionsQuery } from '@/modules/ssh/hooks/queries';
import { buildTeamRolesQueryOptions } from '@/modules/team/hooks/role/queries';
import { buildTeamMembersQueryOptions } from '@/modules/team/hooks/member/queries';
import { buildSecretKeysQueryOptions } from '@/modules/team/hooks/secret-key/queries';
import { buildPluginsQueryOptions } from '@/modules/plugin/hooks/plugin/queries';
import { scriptingNotebooksQuery } from '@/modules/scripting/hooks/queries';
import { simulationCellsQuery } from '@/modules/simulation-cell/hooks/queries';
import { registerPrefetch } from './registry';

registerPrefetch('/dashboard/containers', () => {
    return [containerQuery.useListQuery.buildOptions({ page: 1, limit: 20 })];
});

registerPrefetch('/dashboard/latex', () => {
    return [latexDocumentsQuery.buildOptions({ page: 1, limit: 20 })];
});

registerPrefetch('/dashboard/whiteboards', () => {
    return [whiteboardsQuery.buildOptions({ page: 1, limit: 20 })];
});

registerPrefetch('/dashboard/trajectories/list', () => {
    return [trajectoryQuery.useListQuery.buildOptions({ page: 1, limit: 20 })];
});

registerPrefetch('/dashboard/trajectories/artifacts', () => {
    return [trajectorySamplesQuery.buildOptions(undefined)];
});

registerPrefetch('/dashboard/simulation-cells/list', () => {
    return [simulationCellsQuery.buildOptions({ page: 1, limit: 20 })];
});

registerPrefetch('/dashboard/analysis-configs/list', () => {
    return [analysisQuery.useListQuery.buildOptions({ page: 1, limit: 20 })];
});

registerPrefetch('/dashboard/ssh-connections', () => {
    return [sshConnectionsQuery.buildOptions({ page: 1, limit: 20 })];
});

registerPrefetch('/dashboard/manage-roles', (ctx) => {
    if (!ctx.teamId) return [];
    return [buildTeamRolesQueryOptions({ teamId: ctx.teamId, page: 1, limit: 20 })];
});

registerPrefetch('/dashboard/my-team', (ctx) => {
    if (!ctx.teamId) return [];
    return [buildTeamMembersQueryOptions({ teamId: ctx.teamId, page: 1, limit: 20 })];
});

registerPrefetch('/dashboard/secret-keys', (ctx) => {
    if (!ctx.teamId) return [];
    return [buildSecretKeysQueryOptions({ teamId: ctx.teamId, page: 1, limit: 20 })];
});

registerPrefetch('/dashboard/plugins/list', () => {
    return [buildPluginsQueryOptions({ page: 1, limit: 20 })];
});

registerPrefetch('/dashboard/notebooks', () => {
    return [scriptingNotebooksQuery.buildOptions({ page: 1, limit: 20 })];
});
