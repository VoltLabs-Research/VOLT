type ConnectionWaiter = (socketId: string) => void;

/**
 * Socket bindings and pending connection waiters for a single daemon channel.
 *
 * One instance per channel replaces the parallel per-channel maps the reverse
 * channel service used to keep, so adding a channel needs no new plumbing.
 */
export default class DaemonChannelRegistry{
    #socketIdsByTeamClusterId = new Map<string, string>();
    #waitersByTeamClusterId = new Map<string, ConnectionWaiter[]>();

    socketIdFor(teamClusterId: string): string | undefined{
        return this.#socketIdsByTeamClusterId.get(teamClusterId);
    }

    has(teamClusterId: string): boolean{
        return this.#socketIdsByTeamClusterId.has(teamClusterId);
    }

    bind(teamClusterId: string, socketId: string): void{
        this.#socketIdsByTeamClusterId.set(teamClusterId, socketId);
    }

    release(teamClusterId: string): void{
        this.#socketIdsByTeamClusterId.delete(teamClusterId);
    }

    /** Hands the freshly bound socket to everyone waiting on this cluster. */
    resolveWaiters(teamClusterId: string, socketId: string): void{
        const waiters = this.#waitersByTeamClusterId.get(teamClusterId);
        if(!waiters) return;

        this.#waitersByTeamClusterId.delete(teamClusterId);
        for(const resolve of waiters) resolve(socketId);
    }

    addWaiter(teamClusterId: string, waiter: ConnectionWaiter): void{
        const waiters = this.#waitersByTeamClusterId.get(teamClusterId);
        if(waiters){
            waiters.push(waiter);
            return;
        }
        this.#waitersByTeamClusterId.set(teamClusterId, [waiter]);
    }

    removeWaiter(teamClusterId: string, waiter: ConnectionWaiter): void{
        const waiters = this.#waitersByTeamClusterId.get(teamClusterId);
        if(!waiters) return;

        const index = waiters.indexOf(waiter);
        if(index >= 0) waiters.splice(index, 1);
        if(waiters.length === 0) this.#waitersByTeamClusterId.delete(teamClusterId);
    }
}
