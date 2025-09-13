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

export enum LatticeStructure {
    FCC = 'FCC',
    BCC = 'BCC',
    SC = 'SC',
    HCP = 'HCP',
    CubicDiamond = 'CUBIC_DIAMOND',
    HexDiamond = 'HEX_DIAMOND'
}

export enum IdentificationMode {
    CNA = 'CNA',
    PTM = 'PTM',
    DIAMOND = 'DIAMOND'
}

export interface ConfigParameters {
    crystalStructure: LatticeStructure;
    identificationMode: IdentificationMode;
    maxTrialCircuitSize: number;
    circuitStretchability: number;
    RMSD: number;
    defectMeshSmoothingLevel: number;
    lineSmoothingLevel: number;
    linePointInterval: number;
    onlyPerfectDislocations: boolean;
    markCoreAtoms: boolean;
    structureIdentificationOnly: boolean;
}

export interface StructureTypeStat {
    [key: string]: {
        count: number;
        percentage: number;
        type_id: number;
    }
}

export interface StructureAnalysisData {
    total_atoms: number;
    analysis_method: 'PTM' | 'CNA';
    structure_types: StructureTypeStat;
    summary: {
        total_identified: number;
        total_unidentified: number;
        identification_rate: number;
        unique_structure_types: number;
    }
}