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

export type RGB = [number, number, number];
export type GradientFunction = (t: number) => RGB;

export default class GradientFactory{
    private static lutCache: Map<string, Float32Array> = new Map();
    public static readonly LUT_SIZE = 1024;

    public static getGradientLUT(name: string): Float32Array{
        if(this.lutCache.has(name)){
            return this.lutCache.get(name)!;
        }

        const lut = new Float32Array(this.LUT_SIZE * 3);
        const func = this.resolveFunction(name);

        for(let i = 0; i < this.LUT_SIZE; i++){
            const t = i / (this.LUT_SIZE - 1);
            const [r, g, b] = func(t);
            const idx = i * 3;
            lut[idx] = r;
            lut[idx + 1] = g;
            lut[idx + 2] = b;
        }

        this.lutCache.set(name, lut);
        return lut;
    }

    private static resolveFunction(name: string): GradientFunction{
        switch(name){
            case 'Viridis': return GradientFactory.viridis;
            case 'Plasma': return GradientFactory.plasma;
            case 'Blue-Red': return GradientFactory.blueRed;
            case 'Grayscale': return GradientFactory.grayScale;
            default: return GradientFactory.viridis;
        }
    }

    private static viridis(t: number): RGB{
        const c0 = [0.267004, 0.004874, 0.329415];
        const c1 = [0.127568, 0.566949, 0.550556];
        const c2 = [0.993248, 0.906157, 0.143936];

        if(t < 0.5){
            const localT = t * 2;
            return [
                c0[0] + (c1[0] - c0[0]) * localT,
                c0[1] + (c1[1] - c0[1]) * localT,
                c0[2] + (c1[2] - c0[2]) * localT
            ];
        }

        const localT = (t - 0.5) * 2;
        return [
            c1[0] + (c2[0] - c1[0]) * localT,
            c1[1] + (c2[1] - c1[1]) * localT,
            c1[2] + (c2[2] - c1[2]) * localT
        ];
    }

    private static plasma(t: number): RGB{
        const c0 = [0.050383, 0.029803, 0.527975];
        const c1 = [0.798216, 0.280197, 0.469538];
        const c2 = [0.940015, 0.975158, 0.131326];
        if(t < 0.5){
            const localT = t * 2;
            return [
                c0[0] + (c1[0] - c0[0]) * localT,
                c0[1] + (c1[1] - c0[1]) * localT,
                c0[2] + (c1[2] - c0[2]) * localT
            ];
        }

        const localT = (t - 0.5) * 2;
        return [
            c1[0] + (c2[0] - c1[0]) * localT,
            c1[1] + (c2[1] - c1[1]) * localT,
            c1[2] + (c2[2] - c1[2]) * localT
        ];
    }

    private static blueRed(t: number): RGB{
        // Blue -> White -> Red
        if(t < 0.5){
            const localT = t * 2;
            return [localT, localT, 1];
        }
        const localT = (t - 0.5) * 2;
        return [1, 1 - localT, 1 - localT];
    }

    private static grayScale(t: number): RGB{
        return [t, t, t];
    }
};
