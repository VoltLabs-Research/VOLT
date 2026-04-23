
import type { NetworkMetrics } from '@modules/system/domain/value-objects/SystemMetrics';
import { Singleton } from '@shared/infrastructure/di/decorators';
import logger from '@shared/infrastructure/logger';
import si from 'systeminformation';

const BYTES_PER_KB = 1024;

@Singleton()
export default class NetworkMetricsCollector {
    async collect(): Promise<NetworkMetrics> {
        try {
            const networkStats = await si.networkStats();
            const activeInterfaces = networkStats.filter((stats) => stats.iface !== 'lo');
            const incoming = activeInterfaces.reduce((total, stats) => total + stats.rx_sec, 0) / BYTES_PER_KB;
            const outgoing = activeInterfaces.reduce((total, stats) => total + stats.tx_sec, 0) / BYTES_PER_KB;

            return {
                incoming: Math.round(incoming * 10) / 10,
                outgoing: Math.round(outgoing * 10) / 10,
                total: Math.round((incoming + outgoing) * 10) / 10
            };
        } catch (error: unknown) {
            logger.error(`Error reading network stats: ${error}`);
            return { incoming: 0, outgoing: 0, total: 0 };
        }
    }
}
