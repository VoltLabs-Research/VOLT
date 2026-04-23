import { Singleton } from '@shared/infrastructure/di/decorators';
import si from 'systeminformation';


interface CpuMetricsSnapshot {
    usage: number;
    coresUsage: number[];
}

@Singleton()
export default class CpuMetricsCollector {
    async collect(): Promise<CpuMetricsSnapshot> {
        const currentLoad = await si.currentLoad();

        return {
            usage: Math.min(100, Math.max(0, Math.round(currentLoad.currentLoad))),
            coresUsage: currentLoad.cpus.map((cpu) => Math.min(100, Math.max(0, Math.round(cpu.load))))
        };
    }
}
