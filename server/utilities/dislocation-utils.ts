/**
 * Copyright(c) 2025, Volt Authors. All rights reserved.
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

/**
 * Returns whether the Bufers vector is approximately of type **1/2<111>**.
 *
 * Heuristic:
 *  - All three absolute components must be greather than `tol`.
 *  - The three components should be nearly equal(within `tol` relative spread).
 *  - Magnitude of each component lies roughly in(0.4, 0.6), consistent with ~0.5.
 *
 * @param bx - |b_x|
 * @param by - |b_y|
 * @param bz - |b_z|
 * @param tol - Tolerance used for comparisons(absolute or relative as noted).
 * @returns `true` if vector matches the 1/2<111> pattern, else `false`.
 */
const isType111Half = (bx: number, by: number, bz: number, tol: number): boolean => {
    const components = [bx, by, bz].filter(x => x > tol);
    if(components.length !== 3) return false;

    const maxComp = Math.max(...components);
    const minComp = Math.min(...components);

    return(maxComp - minComp) / maxComp < tol && maxComp > 0.4 && maxComp < 0.6;
}

/**
 * Returns whether the Burgers vector is approximately of type **<100>**.
 *
 * Heuristic:
 *  - Exactly one absolute component is greather than `tol`; the other two are ~0.
 *
 * @param bx - |b_x|
 * @param by - |b_y|
 * @param bz - |b_z|
 * @param tol - Absolute tolerance to consider a component as non-zero.
 * @returns `true` if vector matches the <100> pattern, else `false`.
 */
const isType100 = (bx: number, by: number, bz: number, tol: number): boolean => {
    const nonZeroCount = [bx, by, bz].filter(x => x > tol).length;
    return nonZeroCount === 1;
}

/**
 * Returns whether the Burgers vector is approximately of type **<110>**.
 *
 * Heuristic:
 * - Two largest absolute components are nearly equal(within `tol`),
 * - The smallest component is ~0(below `tol`).
 *
 * @param bx - |b_x|
 * @param by - |b_y|
 * @param bz - |b_z|
 * @param tol - Tolerance used for equality and zero checks.
 * @returns `true` if vector matches the <110> pattern, else `false`.
 */
const isType110 = (bx: number, by: number, bz: number, tol: number): boolean => {
    const components = [bx, by, bz].sort((a, b) => b - a);
    return Math.abs(components[0] - components[1]) < tol && components[2] < tol;
}

/**
 * Returns whether the Burgers vector is approximately of type **<111>**.
 *
 * Heuristic:
 * - Take the maximum absolute component `maxComp`.
 * - All components should be close to `maxComp` (within `tol` relative),
 * - And `maxComp` should be reasonably large(≥ 0.8).
 *
 * @param bx - |b_x|
 * @param by - |b_y|
 * @param bz - |b_z|
 * @param tol - Relative tolerance for component equality.
 * @returns `true` if vector matches the <111> pattern, else `false`.
 */
const isType111 = (bx: number, by: number, bz: number, tol: number): boolean => {
    const maxComp = Math.max(bx, by, bz);
    if(maxComp < tol) return false;

    const ratio1 = Math.abs(bx / maxComp - 1);
    const ratio2 = Math.abs(by / maxComp - 1);
    const ratio3 = Math.abs(bz / maxComp - 1);

    return ratio1 < tol && ratio2 < tol && ratio3 < tol && maxComp >= 0.8;
}

/**
 * Returns whether the Burgers vector is approximately of type **1/6<112>**.
 *
 * Heuristic:
 * - Sort absolute components descending: c0 ≥ c1 ≥ c2.
 * - Require c0/c1 ≈ 2 and c1/c2 ≈ 1(within `tol`),
 * - Restrict overall magnitude(c0 < 0.4) to avoid conflating with larger <112>.
 *
 * @param bx - |b_x|
 * @param by - |b_y|
 * @param bz - |b_z|
 * @param tol - Relative tolerance for ratio checks.
 * @returns `true` if vector matches the 1/6<112> pattern, else `false`.
 */
const isType112Sixth = (bx: number, by: number, bz: number, tol: number): boolean => {
    const components = [bx, by, bz].sort((a, b) => b - a);
    if(components[0] < tol) return false;

    const ratio1 = Math.abs(components[0] / components[1] - 2);
    const ratio2 = Math.abs(components[1] / components[2] - 1);

    return ratio1 < tol && ratio2 < tol && components[0] < 0.4;
}

/**
 * Determines a dislocation type label from a segment's Burgers vector, using a
 * set of geometric heuristics on its absolute components.
 *
 * Supported labels:
 * - `'1/2<111>'`
 * - `'<100>'`
 * - `'<110>'`
 * - `'<111>'`
 * - `'1/6<112>'`
 * - `'Other'` (fallback when none match)
 *
 * ### Notes
 * - The function expects `segment.burgers.vector` to be a 3-element array of numbers.
 * - All tests use absolute component values; direction/sign is ignored.
 * - The default `tolerance` is very small(1e-6). You may need a larger `tol`
 *   for noisy, floating-point, or normalized inputs(e.g., 1e-3 ~ 1e-2).
 *
 * @param segment - Object containing a `burgers.vector: number[3]`.
 * @param tolerance - Numeric tolerance used in all predicates(default: `1e-6`).
 * @returns A short crystallographic label describing the Burgers vector family.
     * ```
 */
export const calculateDislocationType = (segment: any, tolerance: number = 1e-6): string => {
    if(!segment.burgers || !segment.burgers.vector || segment.burgers.vector.length !== 3){
        return 'Other';
    }

    const burgersVector = segment.burgers.vector;
    const [bx, by, bz] = burgersVector.map(Math.abs);

    if(isType111Half(bx, by, bz, tolerance)){
        return '1/2<111>';
    }

    if(isType100(bx, by, bz, tolerance)){
        return '<100>';
    }

    if(isType110(bx, by, bz, tolerance)){
        return '<110>';
    }

    if(isType111(bx, by, bz, tolerance)){
        return '<111>';
    }

    if(isType112Sixth(bx, by, bz, tolerance)){
        return '1/6<112>';
    }

    return 'Other';
};
