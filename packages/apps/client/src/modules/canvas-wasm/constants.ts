export const WASM_CANVAS_PATH = '/canvas/wasm';
export const WASM_TRAJECTORY_ID = 'wasm-local';
export const WASM_PLUGIN_BASE_URL = '/wasm-plugins';
// FCC Al with a 1/2<110> dislocation loop and a void (atomsk), sized to analyse in a couple of seconds.
export const WASM_SAMPLE_DUMP_URL = '/samples/fcc-al-dislocation-loop.dump';

export const isWasmLocalTrajectoryId = (trajectoryId?: string | null): boolean =>
    trajectoryId === WASM_TRAJECTORY_ID;

export const isWasmCanvasLocation = (): boolean =>
    typeof window !== 'undefined' && window.location.pathname === WASM_CANVAS_PATH;
