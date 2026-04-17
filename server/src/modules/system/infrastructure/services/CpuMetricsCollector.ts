import si from 'systeminformation';
import { injectable } from 'tsyringe';

interface CpuMetricsSnapshot {
    usage: number;
    coresUsage: number[];
}

@injectable()
export default class CpuMetricsCollector {
    async collect(): Promise<CpuMetricsSnapshot> {
        const currentLoad = await si.currentLoad();

        return {
            usage: Math.min(100, Math.max(0, Math.round(currentLoad.currentLoad))),
            coresUsage: currentLoad.cpus.map((cpu) => Math.min(100, Math.max(0, Math.round(cpu.load))))
        };
    }
}
