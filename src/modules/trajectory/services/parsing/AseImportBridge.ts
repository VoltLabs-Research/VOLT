import { spawn } from 'node:child_process';
import path from 'node:path';
import readline from 'node:readline';
import type {
    ParsedFrameMetadata,
    ParsedSimulationCell
} from '@modules/trajectory/services/parsing/TrajectoryParserFactory';

const BRIDGE_SCRIPT = path.join(__dirname, 'ase_import_bridge.py');

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
        }
    });

    proc.stderr?.on('data', (chunk: Buffer) => {
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
