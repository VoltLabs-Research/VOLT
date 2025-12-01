/**
 * Copyright (c) 2025, The Volterra Authors. All rights reserved.
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
 */

/**
 * Expands a 10-bit integer so that its bits are separated by two zeros,
 * preparing it for 3D morton (Z-order) interleaving.
 * 
 * @param v - Integer to expand (only the lower `bits` are considered, tipically <= 10).
 * @returns The integer with its bits laid out as `00b9 00b8 ... 00b1 00b0` pattern.
 */
const splitBy3 = (v: number) => {
    v = (v | (v << 16)) & 0x030000FF;
    v = (v | (v << 8))  & 0x0300F00F;
    v = (v | (v << 4))  & 0x030C30C3;
    v = (v | (v << 2))  & 0x09249249;
    return v >>> 0;
};

/**
 * Encodes normalized 3D coordinates into a Morton (Z-order) code.
 * 
 * @param nx - Normalized x in `[0, 1]`.
 * @param ny - Normalized y in `[0, 1]`.
 * @param nz - Normalized z in `[0, 1]`.
 * @param bits - Bit depth per axis (default: `10`). Must satisfy `3 * bits ≤ 32` for 32-bit outputs.
 * @returns Unsigned 32-bit Morton code with interleaved x/y/z bits.
 */
const encodeMorton = (nx: number, ny: number, nz: number, bits = 10): number => {
    const maxv = (1 << bits) - 1;
    
    // Quantize and clamp to integer grid
    let xi = Math.max(0, Math.min(maxv, (nx * maxv) | 0));
    let yi = Math.max(0, Math.min(maxv, (ny * maxv) | 0));
    let zi = Math.max(0, Math.min(maxv, (nz * maxv) | 0));

    // Spread bits are interleave as x|y|z
    const xx = splitBy3(xi);
    const yy = splitBy3(yi);
    const zz = splitBy3(zi);

    return (xx | (yy << 1) | (zz << 2)) >>> 0;
};

export default encodeMorton;