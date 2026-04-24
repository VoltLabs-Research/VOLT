import { Command, CommandGroup } from '@/core/commands/decorators';
import type { TrajectoryPluginParser } from '@/modules/trajectory/application/parsing/TrajectoryPluginParser';

@CommandGroup('trajectory.plugin')
export class TrajectoryPluginCommands {
    constructor(
        private readonly trajectoryPluginParser: TrajectoryPluginParser
    ) {}

    @Command('property-names')
    propertyNames(payload: Parameters<TrajectoryPluginParser['discoverPerAtomPropertyNames']>[0]) {
        return this.trajectoryPluginParser.discoverPerAtomPropertyNames(payload);
    }

    @Command('atom-index')
    atomIndex(payload: Parameters<TrajectoryPluginParser['buildPluginIndexForAtomIds']>[0]) {
        return this.trajectoryPluginParser.buildPluginIndexForAtomIds(payload);
    }

    @Command('modifier-values')
    modifierValues(payload: Parameters<TrajectoryPluginParser['getModifierValues']>[0]) {
        return this.trajectoryPluginParser.getModifierValues(payload);
    }

    @Command('modifier-stats')
    modifierStats(payload: Parameters<TrajectoryPluginParser['getModifierStats']>[0]) {
        return this.trajectoryPluginParser.getModifierStats(payload);
    }

    @Command('modifier-unique-values')
    modifierUniqueValues(payload: Parameters<TrajectoryPluginParser['getModifierUniqueValues']>[0]) {
        return this.trajectoryPluginParser.getModifierUniqueValues(payload);
    }

    @Command('analysis-all-atoms')
    analysisAllAtoms(payload: Parameters<TrajectoryPluginParser['getAnalysisAllPerAtomData']>[0]) {
        return this.trajectoryPluginParser.getAnalysisAllPerAtomData(payload);
    }
}
