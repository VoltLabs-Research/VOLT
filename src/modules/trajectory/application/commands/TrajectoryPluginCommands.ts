import { Command, CommandGroup } from '@/core/commands/decorators';
import type { PluginPropertyStore } from '@/modules/plugin/application/properties/PluginPropertyStore';

@CommandGroup('trajectory.plugin')
export class TrajectoryPluginCommands {
    constructor(
        private readonly pluginPropertyStore: PluginPropertyStore
    ) {}

    @Command('property-names')
    propertyNames(payload: Parameters<PluginPropertyStore['discoverPerAtomPropertyNames']>[0]) {
        return this.pluginPropertyStore.discoverPerAtomPropertyNames(payload);
    }

    @Command('property-schema')
    propertySchema(payload: Parameters<PluginPropertyStore['discoverPerAtomPropertySchemas']>[0]) {
        return this.pluginPropertyStore.discoverPerAtomPropertySchemas(payload);
    }

    @Command('atom-index')
    atomIndex(payload: Parameters<PluginPropertyStore['buildPluginIndexForAtomIds']>[0]) {
        return this.pluginPropertyStore.buildPluginIndexForAtomIds(payload);
    }

    @Command('modifier-values')
    modifierValues(payload: Parameters<PluginPropertyStore['getModifierValues']>[0]) {
        return this.pluginPropertyStore.getModifierValues(payload);
    }

    @Command('modifier-stats')
    modifierStats(payload: Parameters<PluginPropertyStore['getModifierStats']>[0]) {
        return this.pluginPropertyStore.getModifierStats(payload);
    }

    @Command('modifier-unique-values')
    modifierUniqueValues(payload: Parameters<PluginPropertyStore['getModifierUniqueValues']>[0]) {
        return this.pluginPropertyStore.getModifierUniqueValues(payload);
    }

    @Command('analysis-all-atoms')
    analysisAllAtoms(payload: Parameters<PluginPropertyStore['getAnalysisAllPerAtomData']>[0]) {
        return this.pluginPropertyStore.getAnalysisAllPerAtomData(payload);
    }
}
