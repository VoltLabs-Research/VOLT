/**
 * Copyright(c) 2025, The Volterra Authors. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files(the "Software"), to deal
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
 */

import logger from "@/logger";

const taubinSmoothing = (
    positions: Float32Array,
    indices: Uint32Array,
    iterations: number
): void => {
    if(iterations <= 0) return;

    const lambda = 0.5;
    const mu = -0.52;

    logger.info(`Applying Taubin smoothing with ${iterations} iterations(lambda=${lambda}, mu=${mu})...`);

    const vertexCount = positions.length / 3;
    const adjacency: Set<number>[] = Array.from({ length: vertexCount }, () => new Set());
    for(let i = 0; i < indices.length; i += 3){
        const v0 = indices[i];
        const v1 = indices[i + 1];
        const v2 = indices[i + 2];
        adjacency[v0].add(v1).add(v2);
        adjacency[v1].add(v0).add(v2);
        adjacency[v2].add(v0).add(v1);
    }

    let currentPositions = positions;
    const tempPositions = new Float32Array(positions.length);

    for(let iter = 0; iter < iterations; iter++){
        // Calculate P' = P + lambda * L(P), where L(P) is the Laplacian vector.
        for(let i = 0; i < vertexCount; i++){
            const neighbors = Array.from(adjacency[i]);
            const i3 = i * 3;

            if(neighbors.length === 0){
                tempPositions[i3] = currentPositions[i3];
                tempPositions[i3 + 1] = currentPositions[i3 + 1];
                tempPositions[i3 + 2] = currentPositions[i3 + 2];
                continue;
            }

            let avgX = 0, avgY = 0, avgZ = 0;
            for(const neighborIdx of neighbors){
                const n3 = neighborIdx * 3;
                avgX += currentPositions[n3];
                avgY += currentPositions[n3 + 1];
                avgZ += currentPositions[n3 + 2];
            }

            avgX /= neighbors.length;
            avgY /= neighbors.length;
            avgZ /= neighbors.length;

            const laplacianX = avgX - currentPositions[i3];
            const laplacianY = avgY - currentPositions[i3 + 1];
            const laplacianZ = avgZ - currentPositions[i3 + 2];

            tempPositions[i3] = currentPositions[i3] + lambda * laplacianX;
            tempPositions[i3 + 1] = currentPositions[i3 + 1] + lambda * laplacianY;
            tempPositions[i3 + 2] = currentPositions[i3 + 2] + lambda * laplacianZ;
        }

        // Computes P'' = P' + mu * L(P'), using the intermediate positions from tempPositions.
        // The final result of the iteration is written directly to the original 'positions' array.
        for(let i = 0; i < vertexCount; i++){
            const neighbors = Array.from(adjacency[i]);
            const i3 = i * 3;

            if(neighbors.length === 0){
                positions[i3] = tempPositions[i3];
                positions[i3 + 1] = tempPositions[i3 + 1];
                positions[i3 + 2] = tempPositions[i3 + 2];
                continue;
            }

            let avgX = 0, avgY = 0, avgZ = 0;
            for(const neighborIdx of neighbors){
                const n3 = neighborIdx * 3;
                avgX += tempPositions[n3];
                avgY += tempPositions[n3 + 1];
                avgZ += tempPositions[n3 + 2];
            }

            avgX /= neighbors.length;
            avgY /= neighbors.length;
            avgZ /= neighbors.length;

            const laplacianX = avgX - tempPositions[i3];
            const laplacianY = avgY - tempPositions[i3 + 1];
            const laplacianZ = avgZ - tempPositions[i3 + 2];

            positions[i3] = tempPositions[i3] + mu * laplacianX;
            positions[i3 + 1] = tempPositions[i3 + 1] + mu * laplacianY;
            positions[i3 + 2] = tempPositions[i3 + 2] + mu * laplacianZ;
        }
    }
};

export default taubinSmoothing;
