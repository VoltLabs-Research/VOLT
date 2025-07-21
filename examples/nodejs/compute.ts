import opendxa from '../../bindings/nodejs/index';

opendxa.setCrystalStructure(opendxa.LatticeStructure.BCC);
opendxa.setIdentificationMode(opendxa.IdentificationMode.CNA)
const result = opendxa.compute('/home/rodyherrera/Escritorio/Development/OpenDXA/server/storage/trajectories/a4afdc27-99b4-497f-96a5-66a499b898ed/2000000', 'debug.json');