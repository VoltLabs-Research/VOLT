import { getPluginPropertyStore } from '@modules/plugin/services/ParquetPluginPropertyStore';
import { Command, commandGroupFactory } from '@shared/commands/command';
import type { PluginPropertyStore } from '@modules/plugin/services/properties/PluginPropertyStore';
import { DaemonCommand } from '@volt/contracts/modules/cluster/daemon-commands';

export class TrajectoryPluginCommands {
    constructor(
        private readonly pluginPropertyStore: PluginPropertyStore
    ) {}

    @Command(DaemonCommand.TrajectoryPluginPropertyNames)
    propertyNames(payload: Parameters<PluginPropertyStore['discoverPerAtomPropertyNames']>[0]) {
        return this.pluginPropertyStore.discoverPerAtomPropertyNames(payload);
    }

    @Command(DaemonCommand.TrajectoryPluginPropertySchema)
    propertySchema(payload: Parameters<PluginPropertyStore['discoverPerAtomPropertySchemas']>[0]) {
        return this.pluginPropertyStore.discoverPerAtomPropertySchemas(payload);
    }

    @Command(DaemonCommand.TrajectoryPluginAtomIndex)
    atomIndex(payload: Parameters<PluginPropertyStore['buildPluginIndexForAtomIds']>[0]) {
        return this.pluginPropertyStore.buildPluginIndexForAtomIds(payload);
    }

    @Command(DaemonCommand.TrajectoryPluginModifierStats)
    modifierStats(payload: Parameters<PluginPropertyStore['getModifierStats']>[0]) {
        return this.pluginPropertyStore.getModifierStats(payload);
    }

    @Command(DaemonCommand.TrajectoryPluginModifierUniqueValues)
    modifierUniqueValues(payload: Parameters<PluginPropertyStore['getModifierUniqueValues']>[0]) {
        return this.pluginPropertyStore.getModifierUniqueValues(payload);
    }
}

export const getTrajectoryPluginCommands = commandGroupFactory(TrajectoryPluginCommands, () => new TrajectoryPluginCommands(getPluginPropertyStore()));
