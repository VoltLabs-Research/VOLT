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

import * as fs from 'fs';

export const assembleAndWriteGLB = (glbJson: any, binaryBuffer: ArrayBuffer, outputFilePath: string): void => {
    const jsonString = JSON.stringify(glbJson);

    // Prepare the GLB "chunks".
    // The JSON chunk must be 4-byte aligned, padded with spaces (0x20).
    const jsonChunkLength = Buffer.byteLength(jsonString, 'utf8');
    const jsonPadding = (4 - (jsonChunkLength % 4)) % 4;
    const jsonTotalLength = jsonChunkLength + jsonPadding;

    // The binary chunk must be aligned to 4 bytes, padded with zeros (0x00).
    const binaryChunkLength = binaryBuffer.byteLength;
    const binaryPadding = (4 - (binaryChunkLength % 4)) % 4;
    const binaryTotalLength = binaryChunkLength + binaryPadding;

    // Calculate the total length of the GLB file.
    const headerLength = 12;
    const chunkHeaderLength = 8;
    const totalLength = headerLength + (chunkHeaderLength + jsonTotalLength) + (chunkHeaderLength + binaryTotalLength);
  
    // Create the final buffer for the GLB file and a DataView to write to it.
    const glbBuffer = new ArrayBuffer(totalLength);
    const dataView = new DataView(glbBuffer);
    let byteOffset = 0;

    // Write the GLB header (12 bytes)
    // 0x46546C67 (magic number) = gltf
    dataView.setUint32(byteOffset, 0x46546C67, true); 
    byteOffset += 4;

    // version: 2 (GLB)
    dataView.setUint32(byteOffset, 2, true); 
    byteOffset += 4;

    // length
    dataView.setUint32(byteOffset, totalLength, true); 
    byteOffset += 4;

    // Write the JSON chunk header (8 bytes)
    // chunkLength
    dataView.setUint32(byteOffset, jsonTotalLength, true); 
    byteOffset += 4;

    // chunkType: "JSON"
    dataView.setUint32(byteOffset, 0x4E4F534A, true); 
    byteOffset += 4;

    // Write the contents of the JSON chunk
    const jsonUint8Array = new TextEncoder().encode(jsonString);
    new Uint8Array(glbBuffer, byteOffset).set(jsonUint8Array);
    byteOffset += jsonChunkLength;

    // Write the JSON chunk padding with spaces
    for(let i = 0; i < jsonPadding; i++){
        dataView.setUint8(byteOffset++, 0x20);
    }

    // Write the binary chunk header (8 bytes)
    // chunkLength
    dataView.setUint32(byteOffset, binaryTotalLength, true);
    byteOffset += 4;

    // chunkType: "BIN"
    dataView.setUint32(byteOffset, 0x004E4942, true);
    byteOffset += 4;

    // Write the contents of the binary chunk
    new Uint8Array(glbBuffer, byteOffset).set(new Uint8Array(binaryBuffer));
    byteOffset += binaryChunkLength;

    fs.writeFileSync(outputFilePath, Buffer.from(glbBuffer));

    console.log(`Exported GLB: ${outputFilePath}`);
    console.log(`File size: ${(totalLength / (1024 * 1024)).toFixed(2)} MB`);
};