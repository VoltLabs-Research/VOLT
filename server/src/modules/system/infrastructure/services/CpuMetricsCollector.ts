import os from 'os';
import { injectable } from 'tsyringe';
import type { CpuTimeSnapshot } from '@modules/system/domain/contracts';

@injectable()
export default class CpuMetricsCollector {
    private lastCPUTimes: CpuTimeSnapshot[] | null = null;

    getUsage(): number {
        const cpus = os.cpus();
        let totalIdle = 0;
        let totalTick = 0;

        for (const cpu of cpus) {
            const times = cpu.times;
            totalTick += times.user + times.nice + times.sys + times.idle + times.irq;
            totalIdle += times.idle;
        }

        const idle = totalIdle / cpus.length;
        const total = totalTick / cpus.length;
        const usage = 100 - ~~(100 * idle / total);

        return Math.min(100, Math.max(0, usage));
    }

    getCoresUsage(): number[] {
        const cpus = os.cpus();

        const currentTimes: CpuTimeSnapshot[] = cpus.map((cpu) => {
            const times = cpu.times;
            const total = times.user + times.nice + times.sys + times.idle + times.irq;
            return {
                idle: times.idle,
                total
            };
        });

        if (!this.lastCPUTimes) {
            this.lastCPUTimes = currentTimes;
            return cpus.map(() => 0);
        }

        const coreUsages = currentTimes.map((current, index) => {
            const last = this.lastCPUTimes![index];
            const idleDelta = current.idle - last.idle;
            const totalDelta = current.total - last.total;

            if (totalDelta === 0) return 0;

            const usage = 100 - (100 * idleDelta / totalDelta);
            return Math.min(100, Math.max(0, Math.round(usage)));
        });

        this.lastCPUTimes = currentTimes;
        return coreUsages;
    }
}
