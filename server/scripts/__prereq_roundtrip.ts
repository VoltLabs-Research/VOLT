/* Throwaway E2E: prove `plugins` survives strict ArgumentDefinitionSchema + mapper round-trip. */
import 'reflect-metadata';
import mongoose from 'mongoose';
import PluginModel from '@modules/plugin/infrastructure/persistence/mongo/models/plugin/PluginModel';
import PluginMapper from '@modules/plugin/infrastructure/persistence/mongo/mappers/plugin/PluginMapper';
import { mapPluginToPersistedDTO } from '@shared/application/utilities/mapPluginToPersistedDTO';

const PREREQ = ['polyhedral-template-matching', 'adaptive-common-neighbor-analysis', 'pattern-structure-matching'];

const workflow = {
    nodes: [
        { id: 'plugin-metadata', type: 'modifier', position: { x: 0, y: 0 },
          data: { modifier: { name: 'PrereqProbe', key: 'prereq-probe' } } },
        { id: 'plugin-arguments', type: 'arguments', position: { x: 1, y: 0 },
          data: { arguments: { arguments: [
              { argument: 'clusters_table', type: 'string', label: 'Clusters Table',
                inferFromContext: true, plugins: PREREQ },
              { argument: 'plain', type: 'number', label: 'Plain', default: 1 }
          ] } } }
    ],
    edges: []
};

async function main() {
    const uri = process.env.MONGO_URI as string;
    await mongoose.connect(uri, { dbName: 'test' });

    const team = new mongoose.Types.ObjectId();
    const doc = await PluginModel.create({ team, status: 'draft', workflow });
    try {
        // 1) RAW read-back: did strict schema keep `plugins`?
        const raw = await PluginModel.findById(doc._id).lean();
        const rawArg: any = (raw as any).workflow.nodes
            .find((n: any) => n.type === 'arguments').data.arguments.arguments
            .find((a: any) => a.argument === 'clusters_table');
        console.log('RAW plugins      =', JSON.stringify(rawArg?.plugins));

        // 2) Through PluginMapper.toDomain → projection-computed arguments[]
        const fresh = await PluginModel.findById(doc._id);
        const domain = PluginMapper.toDomain(fresh as any);
        const mappedArg: any = (domain.props.arguments ?? []).find((a: any) => a.argument === 'clusters_table');
        console.log('DOMAIN plugins   =', JSON.stringify(mappedArg?.plugins));

        // 3) Through the client-facing DTO mapper
        const dto: any = mapPluginToPersistedDTO(domain as any);
        const dtoArg: any = (dto.arguments ?? []).find((a: any) => a.argument === 'clusters_table');
        console.log('DTO plugins      =', JSON.stringify(dtoArg?.plugins));

        const ok = JSON.stringify(rawArg?.plugins) === JSON.stringify(PREREQ)
            && JSON.stringify(mappedArg?.plugins) === JSON.stringify(PREREQ)
            && JSON.stringify(dtoArg?.plugins) === JSON.stringify(PREREQ);
        console.log(ok ? 'ROUND-TRIP OK' : 'ROUND-TRIP FAIL');
        process.exitCode = ok ? 0 : 1;
    } finally {
        await PluginModel.deleteOne({ _id: doc._id });
        await mongoose.disconnect();
    }
}

main().catch((e) => { console.error(e); process.exit(2); });
