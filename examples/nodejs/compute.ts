import opendxa from '../../bindings/nodejs/index.mjs';

opendxa.setCrystalStructure(opendxa.LatticeStructure.FCC);
opendxa.setIdentificationMode(opendxa.IdentificationMode.CNA)
opendxa.compute('/home/rodyherrera/Descargas/Simulations/test/dump.ensayo.25000.config', 'debug.json');
