import type { NavigateFunction } from 'react-router-dom';
import type { QueryClient } from '@tanstack/react-query';

/**
 * Shared contract for CLIENT-EXECUTED AI tools.
 *
 * These tools are advertised to the model server-side as schema-only tools
 * (see server `AITool` `clientExecuted` mode) and actually run in the browser:
 * `useChat`'s `onToolCall` (in `use-ai-chat-stream.ts`) looks the tool up by
 * name in the registry (`./registry.ts`), runs its handler against React Router
 * / Zustand / the live 3D scene, and returns the result with `addToolResult`.
 *
 * The handler's `name` MUST match the server tool's `name` exactly — that name
 * is the only coupling between the two halves.
 *
 * These types are intentionally client-only (they reference NavigateFunction,
 * QueryClient, and the canvas bridge). The server only needs the tool name and
 * its zod input schema, both of which live in each server tool file.
 */

/** Live viewer context exposed by the canvas bridge store while a trajectory is open. */
export interface CanvasBridgeSnapshot {
    mounted: boolean;
    trajectoryId: string | null;
    timesteps: number[];
    currentTimestep?: number;
    activeSceneId: string | null;
    /** Imperative handle to the mounted FractalScene (camera reset/zoom). */
    resetCamera: (() => void) | null;
    zoomTo: ((zoomPercent: number) => void) | null;
}

/** Everything a client tool handler can act through. */
export interface ClientToolContext {
    navigate: NavigateFunction;
    queryClient: QueryClient;
    /** Reads the live canvas bridge store (returns a snapshot, never null). */
    getCanvasBridge: () => CanvasBridgeSnapshot;
    /** Marks the viewer as AI-driven for a short window (drives the overlay badge). */
    markViewerActing: () => void;
    /** Chat surface control (widget / page / hidden) — wired in Wave 2. */
    setChatSurface?: (surface: 'floating' | 'page' | 'hidden') => void;
}

/**
 * Structured result returned into the stream. `ok:false` with a `reason`/`hint`
 * lets the model recover (e.g. open the viewer, then retry) instead of failing
 * the turn. Keep the payload small and JSON-serializable — it is sent back to
 * the model as the tool output.
 */
export interface ClientToolResult {
    ok: boolean;
    summary: string;
    reason?: string;
    hint?: string;
    data?: unknown;
}

/** A short, human-readable description of what a completed tool call did, for the chat card. */
export interface ClientToolEffectDescription {
    /** Imperative past-tense verb phrase, e.g. "Jumped to frame 240". */
    label: string;
    /** Optional icon key the card maps to an icon. */
    icon?: string;
}

export interface ClientToolHandler<TInput = Record<string, unknown>> {
    /** Must equal the server tool's `name`. */
    readonly name: string;
    /** Whether the tool requires a mounted canvas; the dispatcher fails gracefully if not. */
    readonly needsViewer?: boolean;
    /** Runs the browser-side effect and returns a result for the model. */
    run(input: TInput, ctx: ClientToolContext): Promise<ClientToolResult> | ClientToolResult;
    /** Optional: describe a completed call for the conversation thread card. */
    describeEffect?(input: TInput, result: ClientToolResult): ClientToolEffectDescription;
}

/** Default module shape for files under `./handlers/*.ts`. */
export interface ClientToolModule {
    default: ClientToolHandler;
}
