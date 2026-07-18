import * as p from '@clack/prompts';
import bus from '@/services/EventBus';
import type { AppEvents, PhaseSpec } from '@/types/events';

type Spinner = ReturnType<typeof p.spinner>;
type PhaseStatus = AppEvents['deploy:phase']['status'];

export default class DeployProgress {
    #labels: Record<string, string> = {};
    #spinner: Spinner | null = null;
    #offHandlers: Array<() => void> = [];
    readonly #tty: boolean;

    constructor(){
        this.#tty = !!process.stdout.isTTY;
    }

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

        if(!this.#tty){
            if(status === 'running') console.log(`→ ${label}`);
            else if(status === 'error') console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
            else console.log(`  ✓ ${label}`);
            return;
        }

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
        if(!text) return;
        
        
        if(this.#tty && this.#spinner){
            this.#spinner.message(text);
        }
    }
};
