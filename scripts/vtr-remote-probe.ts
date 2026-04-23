import 'reflect-metadata';
import { container } from 'tsyringe';
import { bootstrapContainer } from '@/app/bootstrap/container';
import { VtrReaderRegistry } from '@/modules/trajectory/application/vtr/VtrReaderRegistry';

const trajectoryId = process.argv[2];
const timestep = Number(process.argv[3]);
const ownerClusterId = process.argv[4];

async function main() {
    await bootstrapContainer();
    const registry = container.resolve(VtrReaderRegistry);
    const reader = await registry.openReader({ trajectoryId, ownerClusterId });
    console.log('reader opened');
    const frame = await reader.readFrame(timestep);
    console.log(`frame t=${frame.timestep} atoms=${frame.atomCount} pos0=[${frame.positions[0]}, ${frame.positions[1]}, ${frame.positions[2]}]`);
}
main().catch((e) => { console.error('FAIL:', e.message, e.stack); process.exit(1); });
