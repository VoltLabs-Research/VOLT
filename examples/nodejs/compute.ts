import opendxa from '../../bindings/nodejs/index.mjs';

opendxa.setCrystalStructure(opendxa.LatticeStructure.BCC);
opendxa.setIdentificationMode(opendxa.IdentificationMode.CNA)
const result = opendxa.compute('/home/rodyherrera/OpenDXA/debug-data/Simulations/T1/Indentation_5nm_300k/dump.indent.1000000', 'debug.json');
console.log(result.dislocations)