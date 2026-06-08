import * as p from '@clack/prompts';
import bus from '@/services/EventBus';
import type { AppEvents, PhaseSpec } from '@/types/events';

type Spinner = ReturnType<typeof p.spinner>;
type PhaseStatus = AppEvents['deploy:phase']['status'];

/**
 * Renders one clack spinner per deploy phase and surfaces the latest container/build
 * line as the active spinner's sub-message. Keeps event wiring out of the CLI entry.
 */
export default class DeployProgress {
    #labels: Record<string, string> = {};
    #spinner: Spinner | null = null;
    #offHandlers: Array<() => void> = [];

    start(): void {
        this.#offHandlers = [
            bus.on('deploy:phases', ({ phases }) => this.#registerLabels(phases)),
            bus.on('deploy:phase', ({ id, status, detail }) => this.#renderPhase(id, status, detail)),
            bus.on('deploy:log', ({ line }) => this.#renderLog(line))
        ];
    }

    stop(): void {
        this.#offHandlers.forEach((off) => off());
        this.#offHandlers = [];
    }

    #registerLabels(phases: PhaseSpec[]): void {
        for(const phase of phases){
            this.#labels[phase.id] = phase.label;
        }
    }

    #renderPhase(id: string, status: PhaseStatus, detail?: string): void {
        const label = this.#labels[id] ?? id;

        if(status === 'running'){
            this.#spinner = p.spinner();
            this.#spinner.start(label);
            return;
        }

        const message = status === 'error' && detail ? `${label} — ${detail}` : label;
        this.#spinner?.stop(message);
        this.#spinner = null;
    }

    #renderLog(line: string): void {
        const text = line.trim();
        if(this.#spinner && text){
            this.#spinner.message(text);
        }
    }
};
