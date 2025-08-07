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

import { Matrix4, Vector3 } from 'three';
import { GLB_CONSTANTS } from '@/utilities/glb/loader';

class ObjectPools{
    private static matrixPool: Matrix4[] = [];
    private static vectorPool: Vector3[] = [];

    static{
        // Initialize pools
        for(let i = 0; i < GLB_CONSTANTS.POOL_SIZE; i++){
            ObjectPools.matrixPool.push(new Matrix4());
            ObjectPools.vectorPool.push(new Vector3());
        }
    }

    static getPooledMatrix(): Matrix4{
        return ObjectPools.matrixPool.pop() || new Matrix4();
    }

    static returnPooledMatrix(matrix: Matrix4): void{
        matrix.identity();
        if(ObjectPools.matrixPool.length < GLB_CONSTANTS.POOL_SIZE){
            ObjectPools.matrixPool.push(matrix);
        }
    }

    static getPooledVector(): Vector3{
        return ObjectPools.vectorPool.pop() || new Vector3();
    }

    static returnPooledVector(vector: Vector3): void{
        vector.set(0, 0, 0);
        if(ObjectPools.vectorPool.length < GLB_CONSTANTS.POOL_SIZE){
            ObjectPools.vectorPool.push(vector);
        }
    }

    static cleanup(): void{
        ObjectPools.matrixPool.length = 0;
        ObjectPools.vectorPool.length = 0;
    }
}

export default ObjectPools;