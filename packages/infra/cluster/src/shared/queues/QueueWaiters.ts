export class QueueWaiters {
    private readonly waiters = new Map<string, Set<() => void>>();

    wait(queue: string, timeoutMs: number): Promise<void> {
        return new Promise((resolve) => {
            let settled = false;
            const settle = (): void => {
                if (settled) return;
                settled = true;

                this.waiters.get(queue)?.delete(settle);
                clearTimeout(timer);
                resolve();
            };

            const timer = setTimeout(settle, timeoutMs);
            timer.unref();

            const queueWaiters = this.waiters.get(queue);
            if (queueWaiters) {
                queueWaiters.add(settle);
            } else {
                this.waiters.set(queue, new Set([settle]));
            }
        });
    }

    wake(queue: string): void {
        const queueWaiters = this.waiters.get(queue);
        if (!queueWaiters) return;

        for (const wake of [...queueWaiters]) wake();
    }

    wakeAll(): void {
        for (const queueWaiters of this.waiters.values()) {
            for (const wake of [...queueWaiters]) wake();
        }
        this.waiters.clear();
    }
}
