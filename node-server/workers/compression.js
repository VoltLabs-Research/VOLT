// workers/compression.js
const { parentPort, workerData } = require('worker_threads');
const { readFile, writeFile, stat, unlink } = require('fs/promises');
const { compress, decompress } = require('@mongodb-js/zstd');
const { join, basename } = require('path');
const { existsSync } = require('fs');

async function compressFile() {
    const { filePath, outputDir, compressionLevel } = workerData;
    
    try {
        if(!existsSync(filePath)){
            throw new Error(`Input file does not exist: ${filePath}`);
        }

        let content = await readFile(filePath, 'utf-8');
        if(!content || content.trim().length === 0){
            throw new Error('File content is empty');
        }

        content = content.trim();
        if(!content.startsWith('{') || !content.endsWith('}')){
            throw new Error('Invalid JSON format');
        }

        let jsonData = JSON.parse(content);
        content = JSON.stringify(jsonData);

        let bytes = Buffer.from(content, 'utf-8');
        const fileBasename = basename(filePath, '.json');
        const timestep = fileBasename.replace('timestep_', '').replace('frame_', '');
        const outputPath = join(outputDir, `${timestep}.json.zst`);

        let compressedData = await compress(bytes, compressionLevel);
        if(compressedData.length === 0){
            throw new Error('Compression produced empty result');
        }
        
        await writeFile(outputPath, compressedData);
        
        const writtenStats = await stat(outputPath);
        if(writtenStats.size !== compressedData.length){
            throw new Error(`File size mismatch: expected ${compressedData.length}, got ${writtenStats.size}`);
        }

        const testCompressed = await readFile(outputPath);
        const testDecompressed = await decompress(testCompressed);
        
        if(!testDecompressed.equals(bytes)){
            if(existsSync(outputPath)){
                await unlink(outputPath);
            }
            throw new Error('Round-trip validation failed');
        }

        const compressionRatio = bytes.length / compressedData.length;
        
        parentPort.postMessage({ 
            success: true, 
            message: `✓ ${basename(filePath)} -> ${basename(outputPath)} (ratio: ${compressionRatio.toFixed(2)}:1)`,
            outputPath,
            compressionRatio
        });

    } catch(error) {
        parentPort.postMessage({ 
            success: false, 
            error: `✗ Error compressing ${filePath}: ${error.message}`
        });
    }
}

compressFile();