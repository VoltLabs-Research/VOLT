import { spawn } from 'node:child_process';
import path from 'node:path';
import readline from 'node:readline';
import type {
    ParsedFrameMetadata,
    ParsedSimulationCell
} from '@/modules/trajectory/application/parsing/TrajectoryParserFactory';

// Path to the Python bridge script (sibling file, shipped as source).
const BRIDGE_SCRIPT = path.join(__dirname, 'ase_import_bridge.py');

// Resolved at module load; callers may override via ASE_PYTHON env for testing.
// Default: the ecosystem-root .venv-pyatomsk (7 levels up from this file's directory).
const ASE_PYTHON = process.env['ASE_PYTHON'] ??
    path.join(__dirname, '../../../../../../../.venv-pyatomsk/bin/python');

interface AseFrame {
    frame: number;
    natoms: number;
    cell: [[number, number, number], [number, number, number], [number, number, number]];
    pbc: [boolean, boolean, boolean];
    symbols: string[];
    positions: number[];
    properties: Record<string, number[]>;
    error?: string;
}

/** Run the ASE bridge for a single file, collect all emitted frames. */
const runBridge = (filePath: string): Promise<AseFrame[]> => new Promise((resolve, reject) => {
    const proc = spawn(ASE_PYTHON, [BRIDGE_SCRIPT, filePath], {
        stdio: ['ignore', 'pipe', 'pipe']
    });

    const frames: AseFrame[] = [];
    const rl = readline.createInterface({ input: proc.stdout! });

    rl.on('line', (line) => {
        if (!line.trim()) return;
        try {
            frames.push(JSON.parse(line) as AseFrame);
        } catch {
            // malformed line — skip
        }
    });

    proc.stderr?.on('data', (chunk: Buffer) => {
        // diagnostics only; suppress in production
        process.stderr.write(chunk);
    });

    proc.on('error', reject);
    proc.on('close', (code) => {
        if (code !== 0 && frames.length === 0) {
            reject(new Error(`ase_import_bridge exited ${code ?? 'null'} with no output`));
        } else {
            resolve(frames);
        }
    });
});

const cellToSimulationCell = (
    cell: AseFrame['cell'],
    pbc: AseFrame['pbc']
): ParsedSimulationCell => {
    const [a, b, c] = cell;
    const width  = Math.abs(a[0]);
    const length = Math.abs(b[1]);
    const height = Math.abs(c[2]);
    return {
        boundingBox: { width, length, height },
        geometry: {
            cell_vectors: cell,
            cell_origin: [0, 0, 0],
            periodic_boundary_conditions: { x: pbc[0], y: pbc[1], z: pbc[2] }
        }
    };
};

/**
 * Parse an ASE-readable file and return only the first frame's metadata.
 * Used by the ingest router for metadata-only pre-scan.
 */
export const parseAseMetadata = async (filePath: string): Promise<ParsedFrameMetadata> => {
    const frames = await runBridge(filePath);
    if (frames.length === 0) {
        throw new Error('Unsupported trajectory format');
    }
    const first = frames[0];
    if (first.error) {
        throw new Error(`ASE bridge: ${first.error}`);
    }
    return {
        timestep: 0,
        natoms: first.natoms,
        headers: ['id', 'type', 'x', 'y', 'z', ...Object.keys(first.properties)],
        simulationCell: cellToSimulationCell(first.cell, first.pbc)
    };
};

