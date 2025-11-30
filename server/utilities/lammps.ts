/**
* Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
*
* Permission is hereby granted, free of charge, to any person obtaining a copy
* of this software and associated documentation files (the "Software"), to deal
* in the Software without restriction, including without limitation the rights
* to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
* copies of the Software, and to permit persons to whom the Software is
* furnished to do so, subject to the following conditions:
*
* The above copyright notice and this permission notice shall be included in all
* copies or substantial portions of the Software.
*
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
* IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
* FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
* AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
* LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
* OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
* SOFTWARE.
**/

import { TimestepInfo } from '@/types/utilities/lammps';
import { readLargeFile } from '@/utilities/fs';

/**
 * Reads a (potentially large) LAMMPS dump file and performs a lightweight
 * validation pass, extracting basic timestep metadata.
 * 
 * The read uses a bounded scan (`maxLines: 10000`) to avoid excessive
 * memory usage while checking for the presence of required LAMMPS items.
 * 
 * @param trajectoryPath - Absolute or relative path to the input LAMMPS dump.
 * @returns A promise resolving to an object with frame info and validation status.
 */
export const processTrajectoryFile = async (
    trajectoryPath: string
): Promise<any> => {
    try {
        let timestepFound = false;
        let frameInfo: any = null;

        const result = await readLargeFile(trajectoryPath, {
            // Limit lines for validation to avoid memory issues
            maxLines: 10000,
            onLine: (line) => {
                if (!timestepFound && line.includes('TIMESTEP')) {
                    timestepFound = true;
                }
            }
        });

        frameInfo = extractTimestepInfo(result.lines);
        const isValid = isValidLammpsFile(result.lines);

        return {
            frameInfo,
            totalLines: result.totalLines,
            timestepFound,
            isValid
        };
    } catch (err) {
        throw err;
    }
};

/**
 * Parse a small set of LAMMPS: "ITEM:" sections from an array of lines.
 * 
 * @param lines - A slice of the input file lines (not necessarily complete).
 * @returns A {@link TimestepInfo} object when all core values are found; otherwise `null`.
 */
export const extractTimestepInfo = (lines: string[]): TimestepInfo | null => {
    let timestep: number | null = null;
    let natoms: number | null = null;
    const boxBounds = { xlo: 0, xhi: 0, ylo: 0, yhi: 0, zlo: 0, zhi: 0 };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line === 'ITEM: TIMESTEP') {
            const nextLine = lines[i + 1];
            if (nextLine) {
                timestep = parseInt(nextLine.trim());
            }
        }

        if (line === 'ITEM: NUMBER OF ATOMS') {
            const nextLine = lines[i + 1];
            if (nextLine) {
                natoms = parseInt(nextLine.trim());
            }
        }

        if (line.startsWith('ITEM: BOX BOUNDS')) {
            for (let j = 1; j <= 3; j++) {
                const boundLine = lines[i + j];
                if (boundLine) {
                    const bounds = boundLine.trim().split(/\s+/).map(Number);
                    if (bounds.length >= 2) {
                        if (j === 1) {
                            boxBounds.xlo = bounds[0];
                            boxBounds.xhi = bounds[1];
                        } else if (j === 2) {
                            boxBounds.ylo = bounds[0];
                            boxBounds.yhi = bounds[1];
                        } else if (j === 3) {
                            boxBounds.zlo = bounds[0];
                            boxBounds.zhi = bounds[1];
                        }
                    }
                }
            }
        }
    }

    if (timestep !== null && natoms !== null) {
        return { timestep, natoms, boxBounds };
    }

    return null;
};

/**
 * Performs a minimal structural validation of a LAMMPS dump by checking for 
 * the presence of required header markers.
 * 
 * @param lines - A slice or the entirety of the input file lines.
 * @returns `true` if all required section headers are present, otherwise `false`.
 */
export const isValidLammpsFile = (lines: string[]): boolean => {
    const requiredItems = [
        'ITEM: TIMESTEP',
        'ITEM: NUMBER OF ATOMS',
        'ITEM: BOX BOUNDS',
        'ITEM: ATOMS'
    ];

    const content = lines.join('\n');
    return requiredItems.every((item) => content.includes(item));
};