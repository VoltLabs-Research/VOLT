'use strict';


const PERIODIC_TABLE = {
    H: {
        symbol: 'H',
        name: 'Hydrogen',
        atomicNumber: 1,
        mass: 1.008,
        color: [1.0, 1.0, 1.0],
        covalentRadius: 0.31,
        vdwRadius: 1.2,
        maxCoordination: 12
    },
    He: {
        symbol: 'He',
        name: 'Helium',
        atomicNumber: 2,
        mass: 4.0026,
        color: [0.851, 1.0, 1.0],
        covalentRadius: 0.28,
        vdwRadius: 1.4,
        maxCoordination: 12
    },
    Li: {
        symbol: 'Li',
        name: 'Lithium',
        atomicNumber: 3,
        mass: 6.94,
        color: [0.8, 0.502, 1.0],
        covalentRadius: 1.28,
        vdwRadius: 1.82,
        maxCoordination: 8
    },
    Be: {
        symbol: 'Be',
        name: 'Beryllium',
        atomicNumber: 4,
        mass: 9.0122,
        color: [0.7608, 1.0, 0.0],
        covalentRadius: 0.96,
        vdwRadius: 1.53,
        maxCoordination: 12
    },
    B: {
        symbol: 'B',
        name: 'Boron',
        atomicNumber: 5,
        mass: 10.81,
        color: [1.0, 0.7098, 0.7098],
        covalentRadius: 0.84,
        vdwRadius: 1.92,
        maxCoordination: 12
    },
    C: {
        symbol: 'C',
        name: 'Carbon',
        atomicNumber: 6,
        mass: 12.011,
        color: [0.5647, 0.5647, 0.5647],
        covalentRadius: 0.76,
        vdwRadius: 1.7,
        maxCoordination: 4
    },
    N: {
        symbol: 'N',
        name: 'Nitrogen',
        atomicNumber: 7,
        mass: 14.007,
        color: [0.1882, 0.3137, 0.9725],
        covalentRadius: 0.71,
        vdwRadius: 1.55,
        maxCoordination: 12
    },
    O: {
        symbol: 'O',
        name: 'Oxygen',
        atomicNumber: 8,
        mass: 15.999,
        color: [1.0, 0.051, 0.051],
        covalentRadius: 0.66,
        vdwRadius: 1.52,
        maxCoordination: 12
    },
    F: {
        symbol: 'F',
        name: 'Fluorine',
        atomicNumber: 9,
        mass: 18.998,
        color: [0.5647, 0.8784, 0.3137],
        covalentRadius: 0.57,
        vdwRadius: 1.47,
        maxCoordination: 12
    },
    Ne: {
        symbol: 'Ne',
        name: 'Neon',
        atomicNumber: 10,
        mass: 20.18,
        color: [0.702, 0.8902, 0.9608],
        covalentRadius: 0.58,
        vdwRadius: 1.54,
        maxCoordination: 12
    },
    Na: {
        symbol: 'Na',
        name: 'Sodium',
        atomicNumber: 11,
        mass: 22.99,
        color: [0.6706, 0.3608, 0.949],
        covalentRadius: 1.66,
        vdwRadius: 2.27,
        maxCoordination: 8
    },
    Mg: {
        symbol: 'Mg',
        name: 'Magnesium',
        atomicNumber: 12,
        mass: 24.305,
        color: [0.5412, 1.0, 0.0],
        covalentRadius: 1.41,
        vdwRadius: 1.73,
        maxCoordination: 12
    },
    Al: {
        symbol: 'Al',
        name: 'Aluminium',
        atomicNumber: 13,
        mass: 26.982,
        color: [0.749, 0.651, 0.651],
        covalentRadius: 1.21,
        vdwRadius: 1.84,
        maxCoordination: 12
    },
    Si: {
        symbol: 'Si',
        name: 'Silicon',
        atomicNumber: 14,
        mass: 28.085,
        color: [0.9412, 0.7843, 0.6275],
        covalentRadius: 1.11,
        vdwRadius: 2.1,
        maxCoordination: 4
    },
    P: {
        symbol: 'P',
        name: 'Phosphorus',
        atomicNumber: 15,
        mass: 30.974,
        color: [1.0, 0.502, 0.0],
        covalentRadius: 1.07,
        vdwRadius: 1.8,
        maxCoordination: 12
    },
    S: {
        symbol: 'S',
        name: 'Sulfur',
        atomicNumber: 16,
        mass: 32.06,
        color: [1.0, 1.0, 0.1882],
        covalentRadius: 1.05,
        vdwRadius: 1.8,
        maxCoordination: 12
    },
    Cl: {
        symbol: 'Cl',
        name: 'Chlorine',
        atomicNumber: 17,
        mass: 35.45,
        color: [0.1216, 0.9412, 0.1216],
        covalentRadius: 1.02,
        vdwRadius: 1.75,
        maxCoordination: 12
    },
    Ar: {
        symbol: 'Ar',
        name: 'Argon',
        atomicNumber: 18,
        mass: 39.948,
        color: [0.502, 0.8196, 0.8902],
        covalentRadius: 1.06,
        vdwRadius: 1.88,
        maxCoordination: 12
    },
    K: {
        symbol: 'K',
        name: 'Potassium',
        atomicNumber: 19,
        mass: 39.098,
        color: [0.5608, 0.251, 0.8314],
        covalentRadius: 2.03,
        vdwRadius: 2.75,
        maxCoordination: 8
    },
    Ca: {
        symbol: 'Ca',
        name: 'Calcium',
        atomicNumber: 20,
        mass: 40.078,
        color: [0.2392, 1.0, 0.0],
        covalentRadius: 1.76,
        vdwRadius: 2.31,
        maxCoordination: 12
    },
    Sc: {
        symbol: 'Sc',
        name: 'Scandium',
        atomicNumber: 21,
        mass: 44.956,
        color: [0.902, 0.902, 0.902],
        covalentRadius: 1.7,
        vdwRadius: 2.11,
        maxCoordination: 12
    },
    Ti: {
        symbol: 'Ti',
        name: 'Titanium',
        atomicNumber: 22,
        mass: 47.867,
        color: [0.749, 0.7608, 0.7804],
        covalentRadius: 1.6,
        vdwRadius: 2.0,
        maxCoordination: 12
    },
    V: {
        symbol: 'V',
        name: 'Vanadium',
        atomicNumber: 23,
        mass: 50.942,
        color: [0.651, 0.651, 0.6706],
        covalentRadius: 1.53,
        vdwRadius: 2.0,
        maxCoordination: 8
    },
    Cr: {
        symbol: 'Cr',
        name: 'Chromium',
        atomicNumber: 24,
        mass: 51.996,
        color: [0.5412, 0.6, 0.7804],
        covalentRadius: 1.39,
        vdwRadius: 2.0,
        maxCoordination: 8
    },
    Mn: {
        symbol: 'Mn',
        name: 'Manganese',
        atomicNumber: 25,
        mass: 54.938,
        color: [0.6118, 0.4784, 0.7804],
        covalentRadius: 1.39,
        vdwRadius: 2.0,
        maxCoordination: 12
    },
    Fe: {
        symbol: 'Fe',
        name: 'Iron',
        atomicNumber: 26,
        mass: 55.845,
        color: [0.8784, 0.4, 0.2],
        covalentRadius: 1.32,
        vdwRadius: 2.0,
        maxCoordination: 8
    },
    Co: {
        symbol: 'Co',
        name: 'Cobalt',
        atomicNumber: 27,
        mass: 58.933,
        color: [0.9412, 0.5647, 0.6275],
        covalentRadius: 1.26,
        vdwRadius: 2.0,
        maxCoordination: 12
    },
    Ni: {
        symbol: 'Ni',
        name: 'Nickel',
        atomicNumber: 28,
        mass: 58.693,
        color: [0.3137, 0.8157, 0.3137],
        covalentRadius: 1.24,
        vdwRadius: 1.63,
        maxCoordination: 12
    },
    Cu: {
        symbol: 'Cu',
        name: 'Copper',
        atomicNumber: 29,
        mass: 63.546,
        color: [0.7843, 0.502, 0.2],
        covalentRadius: 1.32,
        vdwRadius: 1.4,
        maxCoordination: 12
    },
    Zn: {
        symbol: 'Zn',
        name: 'Zinc',
        atomicNumber: 30,
        mass: 65.38,
        color: [0.4902, 0.502, 0.6902],
        covalentRadius: 1.22,
        vdwRadius: 1.39,
        maxCoordination: 12
    },
    Ga: {
        symbol: 'Ga',
        name: 'Gallium',
        atomicNumber: 31,
        mass: 69.723,
        color: [0.7608, 0.5608, 0.5608],
        covalentRadius: 1.22,
        vdwRadius: 1.87,
        maxCoordination: 12
    },
    Ge: {
        symbol: 'Ge',
        name: 'Germanium',
        atomicNumber: 32,
        mass: 72.63,
        color: [0.4, 0.5608, 0.5608],
        covalentRadius: 1.2,
        vdwRadius: 2.11,
        maxCoordination: 4
    },
    As: {
        symbol: 'As',
        name: 'Arsenic',
        atomicNumber: 33,
        mass: 74.922,
        color: [0.7412, 0.502, 0.8902],
        covalentRadius: 1.19,
        vdwRadius: 1.85,
        maxCoordination: 12
    },
    Se: {
        symbol: 'Se',
        name: 'Selenium',
        atomicNumber: 34,
        mass: 78.971,
        color: [1.0, 0.6314, 0.0],
        covalentRadius: 1.2,
        vdwRadius: 1.9,
        maxCoordination: 12
    },
    Br: {
        symbol: 'Br',
        name: 'Bromine',
        atomicNumber: 35,
        mass: 79.904,
        color: [0.651, 0.1608, 0.1608],
        covalentRadius: 1.2,
        vdwRadius: 1.85,
        maxCoordination: 12
    },
    Kr: {
        symbol: 'Kr',
        name: 'Krypton',
        atomicNumber: 36,
        mass: 83.798,
        color: [0.3608, 0.7216, 0.8196],
        covalentRadius: 1.16,
        vdwRadius: 2.02,
        maxCoordination: 12
    },
    Rb: {
        symbol: 'Rb',
        name: 'Rubidium',
        atomicNumber: 37,
        mass: 85.468,
        color: [0.4392, 0.1804, 0.6902],
        covalentRadius: 2.2,
        vdwRadius: 3.03,
        maxCoordination: 8
    },
    Sr: {
        symbol: 'Sr',
        name: 'Strontium',
        atomicNumber: 38,
        mass: 87.62,
        color: [0.0, 1.0, 0.0],
        covalentRadius: 1.95,
        vdwRadius: 2.49,
        maxCoordination: 12
    },
    Y: {
        symbol: 'Y',
        name: 'Yttrium',
        atomicNumber: 39,
        mass: 88.906,
        color: [0.5804, 1.0, 1.0],
        covalentRadius: 1.9,
        vdwRadius: 2.0,
        maxCoordination: 12
    },
    Zr: {
        symbol: 'Zr',
        name: 'Zirconium',
        atomicNumber: 40,
        mass: 91.224,
        color: [0.5804, 0.8784, 0.8784],
        covalentRadius: 1.75,
        vdwRadius: 2.0,
        maxCoordination: 12
    },
    Nb: {
        symbol: 'Nb',
        name: 'Niobium',
        atomicNumber: 41,
        mass: 92.906,
        color: [0.451, 0.7608, 0.7882],
        covalentRadius: 1.64,
        vdwRadius: 2.0,
        maxCoordination: 8
    },
    Mo: {
        symbol: 'Mo',
        name: 'Molybdenum',
        atomicNumber: 42,
        mass: 95.95,
        color: [0.3294, 0.7098, 0.7098],
        covalentRadius: 1.54,
        vdwRadius: 2.0,
        maxCoordination: 8
    },
    Tc: {
        symbol: 'Tc',
        name: 'Technetium',
        atomicNumber: 43,
        mass: 98.0,
        color: [0.2314, 0.6196, 0.6196],
        covalentRadius: 1.47,
        vdwRadius: 2.0,
        maxCoordination: 12
    },
    Ru: {
        symbol: 'Ru',
        name: 'Ruthenium',
        atomicNumber: 44,
        mass: 101.07,
        color: [0.1412, 0.5608, 0.5608],
        covalentRadius: 1.46,
        vdwRadius: 2.0,
        maxCoordination: 12
    },
    Rh: {
        symbol: 'Rh',
        name: 'Rhodium',
        atomicNumber: 45,
        mass: 102.91,
        color: [0.0392, 0.4902, 0.549],
        covalentRadius: 1.42,
        vdwRadius: 2.0,
        maxCoordination: 12
    },
    Pd: {
        symbol: 'Pd',
        name: 'Palladium',
        atomicNumber: 46,
        mass: 106.42,
        color: [0.0, 0.4118, 0.5216],
        covalentRadius: 1.39,
        vdwRadius: 1.63,
        maxCoordination: 12
    },
    Ag: {
        symbol: 'Ag',
        name: 'Silver',
        atomicNumber: 47,
        mass: 107.87,
        color: [0.7529, 0.7529, 0.7529],
        covalentRadius: 1.45,
        vdwRadius: 1.72,
        maxCoordination: 12
    },
    Cd: {
        symbol: 'Cd',
        name: 'Cadmium',
        atomicNumber: 48,
        mass: 112.41,
        color: [1.0, 0.851, 0.5608],
        covalentRadius: 1.44,
        vdwRadius: 1.58,
        maxCoordination: 12
    },
    In: {
        symbol: 'In',
        name: 'Indium',
        atomicNumber: 49,
        mass: 114.82,
        color: [0.651, 0.4588, 0.451],
        covalentRadius: 1.42,
        vdwRadius: 1.93,
        maxCoordination: 12
    },
    Sn: {
        symbol: 'Sn',
        name: 'Tin',
        atomicNumber: 50,
        mass: 118.71,
        color: [0.4, 0.502, 0.502],
        covalentRadius: 1.39,
        vdwRadius: 2.17,
        maxCoordination: 4
    },
    Sb: {
        symbol: 'Sb',
        name: 'Antimony',
        atomicNumber: 51,
        mass: 121.76,
        color: [0.6196, 0.3882, 0.7098],
        covalentRadius: 1.39,
        vdwRadius: 2.06,
        maxCoordination: 12
    },
    Te: {
        symbol: 'Te',
        name: 'Tellurium',
        atomicNumber: 52,
        mass: 127.6,
        color: [0.8314, 0.4784, 0.0],
        covalentRadius: 1.38,
        vdwRadius: 2.06,
        maxCoordination: 12
    },
    I: {
        symbol: 'I',
        name: 'Iodine',
        atomicNumber: 53,
        mass: 126.9,
        color: [0.5804, 0.0, 0.5804],
        covalentRadius: 1.39,
        vdwRadius: 1.98,
        maxCoordination: 12
    },
    Xe: {
        symbol: 'Xe',
        name: 'Xenon',
        atomicNumber: 54,
        mass: 131.29,
        color: [0.2588, 0.6196, 0.6902],
        covalentRadius: 1.4,
        vdwRadius: 2.16,
        maxCoordination: 12
    },
    Cs: {
        symbol: 'Cs',
        name: 'Caesium',
        atomicNumber: 55,
        mass: 132.91,
        color: [0.3412, 0.0902, 0.5608],
        covalentRadius: 2.44,
        vdwRadius: 3.43,
        maxCoordination: 8
    },
    Ba: {
        symbol: 'Ba',
        name: 'Barium',
        atomicNumber: 56,
        mass: 137.33,
        color: [0.0, 0.7882, 0.0],
        covalentRadius: 2.15,
        vdwRadius: 2.68,
        maxCoordination: 8
    },
    La: {
        symbol: 'La',
        name: 'Lanthanum',
        atomicNumber: 57,
        mass: 138.91,
        color: [0.4392, 0.8314, 1.0],
        covalentRadius: 2.07,
        vdwRadius: 2.0,
        maxCoordination: 12
    },
    Ce: {
        symbol: 'Ce',
        name: 'Cerium',
        atomicNumber: 58,
        mass: 140.12,
        color: [1.0, 1.0, 0.7804],
        covalentRadius: 2.04,
        vdwRadius: 2.0,
        maxCoordination: 12
    },
    Pr: {
        symbol: 'Pr',
        name: 'Praseodymium',
        atomicNumber: 59,
        mass: 140.91,
        color: [0.851, 1.0, 0.7804],
        covalentRadius: 2.03,
        vdwRadius: 2.0,
        maxCoordination: 12
    },
    Nd: {
        symbol: 'Nd',
        name: 'Neodymium',
        atomicNumber: 60,
        mass: 144.24,
        color: [0.7804, 1.0, 0.7804],
        covalentRadius: 2.01,
        vdwRadius: 2.0,
        maxCoordination: 12
    },
    Pm: {
        symbol: 'Pm',
        name: 'Promethium',
        atomicNumber: 61,
        mass: 145.0,
        color: [0.6392, 1.0, 0.7804],
        covalentRadius: 1.99,
        vdwRadius: 2.0,
        maxCoordination: 12
    },
    Sm: {
        symbol: 'Sm',
        name: 'Samarium',
        atomicNumber: 62,
        mass: 150.36,
        color: [0.5608, 1.0, 0.7804],
        covalentRadius: 1.98,
        vdwRadius: 2.0,
        maxCoordination: 12
    },
    Eu: {
        symbol: 'Eu',
        name: 'Europium',
        atomicNumber: 63,
        mass: 151.96,
        color: [0.3804, 1.0, 0.7804],
        covalentRadius: 1.98,
        vdwRadius: 2.0,
        maxCoordination: 12
    },
    Gd: {
        symbol: 'Gd',
        name: 'Gadolinium',
        atomicNumber: 64,
        mass: 157.25,
        color: [0.2706, 1.0, 0.7804],
        covalentRadius: 1.96,
        vdwRadius: 2.0,
        maxCoordination: 12
    },
    Tb: {
        symbol: 'Tb',
        name: 'Terbium',
        atomicNumber: 65,
        mass: 158.93,
        color: [0.1882, 1.0, 0.7804],
        covalentRadius: 1.94,
        vdwRadius: 2.0,
        maxCoordination: 12
    },
    Dy: {
        symbol: 'Dy',
        name: 'Dysprosium',
        atomicNumber: 66,
        mass: 162.5,
        color: [0.1216, 1.0, 0.7804],
        covalentRadius: 1.92,
        vdwRadius: 2.0,
        maxCoordination: 12
    },
    Ho: {
        symbol: 'Ho',
        name: 'Holmium',
        atomicNumber: 67,
        mass: 164.93,
        color: [0.0, 1.0, 0.6118],
        covalentRadius: 1.92,
        vdwRadius: 2.0,
        maxCoordination: 12
    },
    Er: {
        symbol: 'Er',
        name: 'Erbium',
        atomicNumber: 68,
        mass: 167.26,
        color: [0.0, 0.902, 0.4588],
        covalentRadius: 1.89,
        vdwRadius: 2.0,
        maxCoordination: 12
    },
    Tm: {
        symbol: 'Tm',
        name: 'Thulium',
        atomicNumber: 69,
        mass: 168.93,
        color: [0.0, 0.8314, 0.3216],
        covalentRadius: 1.9,
        vdwRadius: 2.0,
        maxCoordination: 12
    },
    Yb: {
        symbol: 'Yb',
        name: 'Ytterbium',
        atomicNumber: 70,
        mass: 173.05,
        color: [0.0, 0.749, 0.2196],
        covalentRadius: 1.87,
        vdwRadius: 2.0,
        maxCoordination: 12
    },
    Lu: {
        symbol: 'Lu',
        name: 'Lutetium',
        atomicNumber: 71,
        mass: 174.97,
        color: [0.0, 0.6706, 0.1412],
        covalentRadius: 1.87,
        vdwRadius: 2.0,
        maxCoordination: 12
    },
    Hf: {
        symbol: 'Hf',
        name: 'Hafnium',
        atomicNumber: 72,
        mass: 178.49,
        color: [0.302, 0.7608, 1.0],
        covalentRadius: 1.75,
        vdwRadius: 2.0,
        maxCoordination: 12
    },
    Ta: {
        symbol: 'Ta',
        name: 'Tantalum',
        atomicNumber: 73,
        mass: 180.95,
        color: [0.302, 0.651, 1.0],
        covalentRadius: 1.7,
        vdwRadius: 2.0,
        maxCoordination: 8
    },
    W: {
        symbol: 'W',
        name: 'Tungsten',
        atomicNumber: 74,
        mass: 183.84,
        color: [0.1294, 0.5804, 0.8392],
        covalentRadius: 1.62,
        vdwRadius: 2.0,
        maxCoordination: 8
    },
    Re: {
        symbol: 'Re',
        name: 'Rhenium',
        atomicNumber: 75,
        mass: 186.21,
        color: [0.149, 0.4902, 0.6706],
        covalentRadius: 1.51,
        vdwRadius: 2.0,
        maxCoordination: 12
    },
    Os: {
        symbol: 'Os',
        name: 'Osmium',
        atomicNumber: 76,
        mass: 190.23,
        color: [0.149, 0.4, 0.5882],
        covalentRadius: 1.44,
        vdwRadius: 2.0,
        maxCoordination: 12
    },
    Ir: {
        symbol: 'Ir',
        name: 'Iridium',
        atomicNumber: 77,
        mass: 192.22,
        color: [0.0902, 0.3294, 0.5294],
        covalentRadius: 1.41,
        vdwRadius: 2.0,
        maxCoordination: 12
    },
    Pt: {
        symbol: 'Pt',
        name: 'Platinum',
        atomicNumber: 78,
        mass: 195.08,
        color: [0.8157, 0.8157, 0.8784],
        covalentRadius: 1.36,
        vdwRadius: 1.75,
        maxCoordination: 12
    },
    Au: {
        symbol: 'Au',
        name: 'Gold',
        atomicNumber: 79,
        mass: 196.97,
        color: [1.0, 0.8196, 0.1373],
        covalentRadius: 1.36,
        vdwRadius: 1.66,
        maxCoordination: 12
    },
    Hg: {
        symbol: 'Hg',
        name: 'Mercury',
        atomicNumber: 80,
        mass: 200.59,
        color: [0.7216, 0.7216, 0.8157],
        covalentRadius: 1.32,
        vdwRadius: 1.55,
        maxCoordination: 12
    },
    Tl: {
        symbol: 'Tl',
        name: 'Thallium',
        atomicNumber: 81,
        mass: 204.38,
        color: [0.651, 0.3294, 0.302],
        covalentRadius: 1.45,
        vdwRadius: 1.96,
        maxCoordination: 12
    },
    Pb: {
        symbol: 'Pb',
        name: 'Lead',
        atomicNumber: 82,
        mass: 207.2,
        color: [0.3412, 0.349, 0.3804],
        covalentRadius: 1.46,
        vdwRadius: 2.02,
        maxCoordination: 12
    },
    Bi: {
        symbol: 'Bi',
        name: 'Bismuth',
        atomicNumber: 83,
        mass: 208.98,
        color: [0.6196, 0.3098, 0.7098],
        covalentRadius: 1.48,
        vdwRadius: 2.07,
        maxCoordination: 12
    },
    Po: {
        symbol: 'Po',
        name: 'Polonium',
        atomicNumber: 84,
        mass: 209.0,
        color: [0.6706, 0.3608, 0.0],
        covalentRadius: 1.4,
        vdwRadius: 1.97,
        maxCoordination: 12
    },
    At: {
        symbol: 'At',
        name: 'Astatine',
        atomicNumber: 85,
        mass: 210.0,
        color: [0.4588, 0.3098, 0.2706],
        covalentRadius: 1.5,
        vdwRadius: 2.02,
        maxCoordination: 12
    },
    Rn: {
        symbol: 'Rn',
        name: 'Radon',
        atomicNumber: 86,
        mass: 222.0,
        color: [0.2588, 0.5098, 0.5882],
        covalentRadius: 1.5,
        vdwRadius: 2.2,
        maxCoordination: 12
    },
    Fr: {
        symbol: 'Fr',
        name: 'Francium',
        atomicNumber: 87,
        mass: 223.0,
        color: [0.2588, 0.0, 0.4],
        covalentRadius: 2.6,
        vdwRadius: 3.48,
        maxCoordination: 12
    },
    Ra: {
        symbol: 'Ra',
        name: 'Radium',
        atomicNumber: 88,
        mass: 226.0,
        color: [0.0, 0.4902, 0.0],
        covalentRadius: 2.21,
        vdwRadius: 2.83,
        maxCoordination: 12
    },
    Ac: {
        symbol: 'Ac',
        name: 'Actinium',
        atomicNumber: 89,
        mass: 227.0,
        color: [0.4392, 0.6706, 0.9804],
        covalentRadius: 2.15,
        vdwRadius: 2.0,
        maxCoordination: 12
    },
    Th: {
        symbol: 'Th',
        name: 'Thorium',
        atomicNumber: 90,
        mass: 232.04,
        color: [0.0, 0.7294, 1.0],
        covalentRadius: 2.06,
        vdwRadius: 2.4,
        maxCoordination: 12
    },
    Pa: {
        symbol: 'Pa',
        name: 'Protactinium',
        atomicNumber: 91,
        mass: 231.04,
        color: [0.0, 0.6314, 1.0],
        covalentRadius: 2.0,
        vdwRadius: 2.0,
        maxCoordination: 12
    },
    U: {
        symbol: 'U',
        name: 'Uranium',
        atomicNumber: 92,
        mass: 238.03,
        color: [0.0, 0.5608, 1.0],
        covalentRadius: 1.96,
        vdwRadius: 1.86,
        maxCoordination: 12
    },
    Np: {
        symbol: 'Np',
        name: 'Neptunium',
        atomicNumber: 93,
        mass: 237.0,
        color: [0.0, 0.502, 1.0],
        covalentRadius: 1.9,
        vdwRadius: 2.0,
        maxCoordination: 12
    },
    Pu: {
        symbol: 'Pu',
        name: 'Plutonium',
        atomicNumber: 94,
        mass: 244.0,
        color: [0.0, 0.4196, 1.0],
        covalentRadius: 1.87,
        vdwRadius: 2.0,
        maxCoordination: 12
    },
    Am: {
        symbol: 'Am',
        name: 'Americium',
        atomicNumber: 95,
        mass: 243.0,
        color: [0.3294, 0.3608, 0.949],
        covalentRadius: 1.8,
        vdwRadius: 2.0,
        maxCoordination: 12
    },
    Cm: {
        symbol: 'Cm',
        name: 'Curium',
        atomicNumber: 96,
        mass: 247.0,
        color: [0.4706, 0.3608, 0.8902],
        covalentRadius: 1.69,
        vdwRadius: 2.0,
        maxCoordination: 12
    },
    Bk: {
        symbol: 'Bk',
        name: 'Berkelium',
        atomicNumber: 97,
        mass: 247.0,
        color: [0.5412, 0.3098, 0.8902],
        covalentRadius: 1.5,
        vdwRadius: 2.0,
        maxCoordination: 12
    },
    Cf: {
        symbol: 'Cf',
        name: 'Californium',
        atomicNumber: 98,
        mass: 251.0,
        color: [0.6314, 0.2118, 0.8314],
        covalentRadius: 1.5,
        vdwRadius: 2.0,
        maxCoordination: 12
    },
    Es: {
        symbol: 'Es',
        name: 'Einsteinium',
        atomicNumber: 99,
        mass: 252.0,
        color: [0.702, 0.1216, 0.8314],
        covalentRadius: 1.5,
        vdwRadius: 2.0,
        maxCoordination: 12
    },
    Fm: {
        symbol: 'Fm',
        name: 'Fermium',
        atomicNumber: 100,
        mass: 257.0,
        color: [0.702, 0.1216, 0.7294],
        covalentRadius: 1.5,
        vdwRadius: 2.0,
        maxCoordination: 12
    },
    Md: {
        symbol: 'Md',
        name: 'Mendelevium',
        atomicNumber: 101,
        mass: 258.0,
        color: [0.702, 0.051, 0.651],
        covalentRadius: 1.5,
        vdwRadius: 2.0,
        maxCoordination: 12
    },
    No: {
        symbol: 'No',
        name: 'Nobelium',
        atomicNumber: 102,
        mass: 259.0,
        color: [0.7412, 0.051, 0.5294],
        covalentRadius: 1.5,
        vdwRadius: 2.0,
        maxCoordination: 12
    },
    Lr: {
        symbol: 'Lr',
        name: 'Lawrencium',
        atomicNumber: 103,
        mass: 266.0,
        color: [0.7804, 0.0, 0.4],
        covalentRadius: 1.5,
        vdwRadius: 2.0,
        maxCoordination: 12
    },
    Rf: {
        symbol: 'Rf',
        name: 'Rutherfordium',
        atomicNumber: 104,
        mass: 267.0,
        color: [0.8, 0.0, 0.349],
        covalentRadius: 1.5,
        vdwRadius: 2.0,
        maxCoordination: 12
    },
    Db: {
        symbol: 'Db',
        name: 'Dubnium',
        atomicNumber: 105,
        mass: 268.0,
        color: [0.8196, 0.0, 0.3098],
        covalentRadius: 1.5,
        vdwRadius: 2.0,
        maxCoordination: 12
    },
    Sg: {
        symbol: 'Sg',
        name: 'Seaborgium',
        atomicNumber: 106,
        mass: 269.0,
        color: [0.851, 0.0, 0.2706],
        covalentRadius: 1.5,
        vdwRadius: 2.0,
        maxCoordination: 12
    },
    Bh: {
        symbol: 'Bh',
        name: 'Bohrium',
        atomicNumber: 107,
        mass: 270.0,
        color: [0.8784, 0.0, 0.2196],
        covalentRadius: 1.5,
        vdwRadius: 2.0,
        maxCoordination: 12
    },
    Hs: {
        symbol: 'Hs',
        name: 'Hassium',
        atomicNumber: 108,
        mass: 269.0,
        color: [0.902, 0.0, 0.1804],
        covalentRadius: 1.5,
        vdwRadius: 2.0,
        maxCoordination: 12
    },
    Mt: {
        symbol: 'Mt',
        name: 'Meitnerium',
        atomicNumber: 109,
        mass: 278.0,
        color: [0.9216, 0.0, 0.149],
        covalentRadius: 1.5,
        vdwRadius: 2.0,
        maxCoordination: 12
    },
    Ds: {
        symbol: 'Ds',
        name: 'Darmstadtium',
        atomicNumber: 110,
        mass: 281.0,
        color: [1.0, 0.4118, 0.7059],
        covalentRadius: 1.5,
        vdwRadius: 2.0,
        maxCoordination: 12
    },
    Rg: {
        symbol: 'Rg',
        name: 'Roentgenium',
        atomicNumber: 111,
        mass: 282.0,
        color: [1.0, 0.4118, 0.7059],
        covalentRadius: 1.5,
        vdwRadius: 2.0,
        maxCoordination: 12
    },
    Cn: {
        symbol: 'Cn',
        name: 'Copernicium',
        atomicNumber: 112,
        mass: 285.0,
        color: [1.0, 0.4118, 0.7059],
        covalentRadius: 1.5,
        vdwRadius: 2.0,
        maxCoordination: 12
    },
    Nh: {
        symbol: 'Nh',
        name: 'Nihonium',
        atomicNumber: 113,
        mass: 286.0,
        color: [1.0, 0.4118, 0.7059],
        covalentRadius: 1.5,
        vdwRadius: 2.0,
        maxCoordination: 12
    },
    Fl: {
        symbol: 'Fl',
        name: 'Flerovium',
        atomicNumber: 114,
        mass: 289.0,
        color: [1.0, 0.4118, 0.7059],
        covalentRadius: 1.5,
        vdwRadius: 2.0,
        maxCoordination: 12
    },
    Mc: {
        symbol: 'Mc',
        name: 'Moscovium',
        atomicNumber: 115,
        mass: 290.0,
        color: [1.0, 0.4118, 0.7059],
        covalentRadius: 1.5,
        vdwRadius: 2.0,
        maxCoordination: 12
    },
    Lv: {
        symbol: 'Lv',
        name: 'Livermorium',
        atomicNumber: 116,
        mass: 293.0,
        color: [1.0, 0.4118, 0.7059],
        covalentRadius: 1.5,
        vdwRadius: 2.0,
        maxCoordination: 12
    },
    Ts: {
        symbol: 'Ts',
        name: 'Tennessine',
        atomicNumber: 117,
        mass: 294.0,
        color: [1.0, 0.4118, 0.7059],
        covalentRadius: 1.5,
        vdwRadius: 2.0,
        maxCoordination: 12
    },
    Og: {
        symbol: 'Og',
        name: 'Oganesson',
        atomicNumber: 118,
        mass: 294.0,
        color: [1.0, 0.4118, 0.7059],
        covalentRadius: 1.5,
        vdwRadius: 2.0,
        maxCoordination: 12
    }
};


const DEFAULT_UNITS = 'metal';



const ELEMENT_SYMBOLS = Object.keys(PERIODIC_TABLE);

const DEFAULT_TYPE_PALETTE = [
    [0.9, 0.2, 0.2], [0.2, 0.4, 0.9], [0.2, 0.8, 0.3], [0.9, 0.7, 0.2],
    [0.7, 0.3, 0.85], [0.25, 0.8, 0.85], [0.95, 0.5, 0.2], [0.6, 0.6, 0.6],
    [0.85, 0.4, 0.6], [0.5, 0.75, 0.3]
];

const typePaletteColor = (type) => {
    const palette = DEFAULT_TYPE_PALETTE;
    const index = ((type - 1) % palette.length + palette.length) % palette.length;
    return palette[index];
};

const inferElementFromMass = (mass, tolerance = 0.5) => {
    let best = null;
    let bestDelta = tolerance;
    for (const symbol of ELEMENT_SYMBOLS) {
        const delta = Math.abs(PERIODIC_TABLE[symbol].mass - mass);
        if (delta < bestDelta) {
            bestDelta = delta;
            best = symbol;
        }
    }
    return best;
};



const buildElementTableEntry = (type, symbol, mass) => {
    if (symbol) {
        const reference = PERIODIC_TABLE[symbol];
        return {
            type,
            symbol: reference.symbol,
            displayName: reference.name,
            color: [...reference.color],
            radius: reference.covalentRadius,
            mass: mass ?? reference.mass,
            covalentRadius: reference.covalentRadius,
            vdwRadius: reference.vdwRadius,
            maxCoordination: reference.maxCoordination
        };
    }

    return {
        type,
        symbol: `Type${type}`,
        displayName: `Type ${type}`,
        color: typePaletteColor(type),
        radius: 1.0,
        mass: mass ?? 0,
        covalentRadius: 1.0,
        vdwRadius: 1.0,
        maxCoordination: 12
    };
};

const ELEMENT_SYMBOL_SET = new Set(Object.keys(PERIODIC_TABLE));

const resolveElementSymbol = (hint, mass) => {
    if (hint) {
        const normalized = hint.trim();
        const canonical = normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase();
        if (ELEMENT_SYMBOL_SET.has(canonical)) return canonical;
    }
    if (mass !== undefined && mass > 0) return inferElementFromMass(mass);
    return null;
};

const buildElementTable = (input) => {
    const table = [];
    for (let typeIndex = 0; typeIndex < input.typeCount; typeIndex++) {
        const type = typeIndex + 1;
        const mass = input.massesByType?.[typeIndex];
        const hint = input.elementHintsByType?.[typeIndex] ?? null;
        const symbol = resolveElementSymbol(hint, mass);
        table.push(buildElementTableEntry(type, symbol, mass));
    }
    return table;
};

module.exports = {
    DEFAULT_UNITS,
    buildElementTable
};
