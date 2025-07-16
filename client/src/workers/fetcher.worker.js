/* *****************************************************************************
 *
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
 *
***************************************************************************** */

import createZstdModule from '../../public/zstd_stream';

const fetchFrame = async (folderId, timestep) => {
    const url = `http://192.168.1.85:8000/api/dislocations/compressed/${folderId}/${timestep}.json.zst`;
    let decompressor;
    try{
        const module = await createZstdModule();
        decompressor = new module.StreamingZstdDecompressor();
        const response = await fetch(url);
        if(!response.ok){
            throw new Error(`HTTP ${response.status}: Failed to fetch stream from ${url}`);
        }
        const reader = response.body.getReader();
        const textDecoder = new TextDecoder();
        let decompressedJsonString = '';
        while(true){
            const { done, value } = await reader.read();
            if(done) break;
            const decompressedChunk = decompressor.decompress(value);
            decompressedJsonString += textDecoder.decode(decompressedChunk, { stream: true });
        }
        const jsonData = JSON.parse(decompressedJsonString);
        return parseAnalysisJson(jsonData, timestep);
    }finally{
        if(decompressor) decompressor.delete();
    }
};

const parseAnalysisJson = (data, timestep) => {
    const atomsList = data.atoms?.data || [];
    const numAtoms = atomsList.length;
    console.log(`[Worker] Parsing ${numAtoms} atoms for timestep ${timestep}...`);

    const positions = new Float32Array(numAtoms *  3);
    const ids = new Uint32Array(numAtoms);
    const lammpsTypes = new Uint8Array(numAtoms);

    atomsList.forEach((atom, i) => {
        // (x, y, z) positions
        const pos = atom.position || [0, 0, 0];
        const posIndex = i * 3;
        positions[posIndex] = pos[0];
        positions[posIndex + 1] = pos[1];
        positions[posIndex + 2] = pos[2];

        ids[i] = atom.node_id ?? 0;

        lammpsTypes[i] = atom.lammps_type ?? 0;
    });

    const atomsData = {
        total_atoms: numAtoms,
        timestep,
        positions,
        ids,
        lammps_types: lammpsTypes
    };

    const dislocationList = data.dislocations?.data || [];
    const dislocationData = dislocationList.map((dislocation, i) => ({
        id: dislocation.id ?? dislocation.index ?? i,
        points: dislocation.points || [],
        length: dislocation.length || 0,
        type: dislocation.type || 'unknown',
        is_closed_loop: dislocation.is_closed_loop || false,
        burgers: {
            vector: dislocation.burgers?.vector || [0, 0, 0],
            magnitude: dislocation.burgers?.magnitude || 0,
            fractional: dislocation.burgers?.fractional || '',
        }
    }));

    const dislocationResults = {
        total_dislocations: data.network_statistics?.segment_count ?? dislocationData.length,
        total_length: data.network_statistics?.total_network_length ?? data.dislocations?.summary?.total_length ?? 0,
        density: data.network_statistics?.density ?? 0,
    };

    console.log(`[Worker] Successfully created data structure for timestep ${timestep}.`);
    return {
        atoms_data: atomsData,
        dislocation_data: dislocationData,
        dislocation_results: dislocationResults
    };
};

self.onmessage = async (event) => {
    const { folderId, timestep } = event.data;

    if(typeof timestep === 'undefined' || timestep === null){
        const errorMessage = '[Worker] Received job with undefined or null timestep. Aborting.';
        console.error(errorMessage, event.data);
        self.postMessage({ status: 'error', error: errorMessage });
        return;
    }

    try{
        const resultData = await fetchFrame(folderId, timestep);
        const transferableObjects = [
            resultData.atoms_data.positions.buffer,
            resultData.atoms_data.ids.buffer,
            resultData.atoms_data.lammps_types.buffer
        ];
        self.postMessage({ status: 'success', data: resultData }, transferableObjects);
    }catch(error){
        const errorMessage = `A critical error occurred in worker for timestep ${timestep}: ${error.message}`;
        console.error(errorMessage, error);
        self.postMessage({ status: 'error', error: errorMessage });
    }
};