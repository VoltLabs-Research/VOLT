import { PLUGIN_TOKENS } from '@modules/plugin/di/PluginTokens';
import Plugin, { PluginProps } from '@modules/plugin/entities/plugin/Plugin';
import Workflow from '@modules/plugin/entities/plugin/workflow/Workflow';
import PluginModel, { PluginDocument } from '@modules/plugin/models/plugin/PluginModel';
import WorkflowProjectionService from '@modules/plugin/utilities/plugin/WorkflowProjectionService';
import { Singleton } from '@shared/infrastructure/di/decorators';

import { BaseMapper } from '@shared/infrastructure/persistence/mongo/MongoBaseMapper';
import { MongooseBaseRepository } from '@shared/infrastructure/persistence/mongo/MongooseBaseRepository';
import type { IPluginRepository as IPluginRepositoryContract } from '@shared/contracts/ports/IPluginRepository';

export type IPluginRepository = IPluginRepositoryContract<Plugin, PluginProps>;

/**
 * The document <-> `Plugin` domain mapping (formerly `mappers/plugin/PluginMapper.ts`),
 * folded into the kept adapter. `toDomain` rebuilds the `Workflow` DSL entity and
 * re-runs {@link WorkflowProjectionService} so a persisted plugin always carries a
 * resolved modifier/exposures/arguments/listing projection.
 */
class PluginDocumentMapper extends BaseMapper<Plugin, PluginProps, PluginDocument> {
    constructor() {
        super(Plugin, ['team']);
    }

    toDomain(doc: PluginDocument): Plugin {
        const rawProps = doc.toObject({ flattenMaps: true });
        const {
            _id: ignoredId,
            __v: ignoredVersion,
            workflow: workflowProps,
            validated: _ignoredValidated,
            validationErrors: _ignoredValidationErrors,
            ...props
        } = rawProps;
        const workflow = new Workflow(doc._id.toString(), workflowProps);
        const projection = WorkflowProjectionService.project(workflow, doc._id.toString());

        const resolvedModifier = props.modifier ?? projection.modifier;
        const resolvedExposures = props.exposures ?? projection.exposures;
        const resolvedArguments = props.arguments ?? projection.arguments;
        const resolvedListingExposures = props.listingExposures ?? projection.listingExposures;
        const resolvedProducesExposures = props.producesExposures ?? projection.producesExposures;
        const resolvedRequiresExposures = props.requiresExposures ?? projection.requiresExposures;

        return new Plugin(doc._id.toString(), {
            ...props,
            workflow,
            modifier: resolvedModifier,
            exposures: resolvedExposures,
            arguments: resolvedArguments,
            listingExposures: resolvedListingExposures,
            producesExposures: resolvedProducesExposures,
            requiresExposures: resolvedRequiresExposures
        });
    }

    toPersistence(domainOrProps: Plugin | PluginProps): Partial<PluginDocument> {
        const persistenceData = super.toPersistence(domainOrProps);
        const source = domainOrProps instanceof Plugin
            ? domainOrProps.props
            : domainOrProps;

        if (!source.workflow) {
            return persistenceData;
        }

        return {
            ...persistenceData,
            workflow: source.workflow.props as unknown as PluginDocument['workflow']
        };
    }
}

/**
 * Thin, model-backed Plugin repository adapter. The plugin module was collapsed
 * to a plain {@link PluginService} that talks to {@link PluginModel} directly, but
 * this adapter is KEPT (registered under the neutral `COMPUTE_TOKENS.PluginRepository`
 * token) because clean cross-module consumers resolve it there — dashboard global
 * search, cluster StoragePlacement, trajectory atom/line-style — plus the kept
 * plugin collaborator singletons (PluginStorageService, AnalysisListingExportCatalogService)
 * and the debug socket module. It returns `Plugin` domain entities. Analogous to
 * container's retained `ContainerSearchRepository`.
 */
@Singleton(PLUGIN_TOKENS.PluginRepository)
export default class PluginRepository
    extends MongooseBaseRepository<Plugin, PluginProps, PluginDocument>
    implements IPluginRepository {
    constructor() {
        super(PluginModel, new PluginDocumentMapper());
    }

    async findByIds(ids: string[]): Promise<Plugin[]> {
        if (!ids.length) {
            return [];
        }

        const documents = await this.model.find({
            _id: {
                $in: ids
            }
        }).exec();

        return documents.map((document) => this.mapper.toDomain(document));
    }

    async findByTeamAndModifierKey(teamId: string, modifierKey: string): Promise<Plugin | null> {
        const key = modifierKey.trim();
        if (!teamId || !key) {
            return null;
        }

        const document = await this.model.findOne({
            team: teamId,
            'modifier.key': key
        }).exec();

        return document ? this.mapper.toDomain(document) : null;
    }
}
