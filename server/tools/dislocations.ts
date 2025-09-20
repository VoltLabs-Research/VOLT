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

import DislocationExporter from '@/utilities/export/dislocations';
import { readMsgpackFile } from '@/utilities/msgpack';

const main = async () => {
    const msgpackPath = process.argv[2];
    const glbPath = process.argv[3];

    const dislocationData = await readMsgpackFile(msgpackPath);

    const exporter = new DislocationExporter();
    exporter.toGLB(dislocationData, glbPath, {
        lineWidth: 0.8,
        colorByType: true,
        material: {
            baseColor: [1.0, 0.5, 0.0, 1.0],
            metallic: 0.0,
            roughness: 0.8,
            emissive: [0.0, 0.0, 0.0]
        }
    });
};

main();