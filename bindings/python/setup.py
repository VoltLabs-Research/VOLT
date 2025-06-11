from setuptools import setup, Extension
from pybind11.setup_helpers import Pybind11Extension, build_ext
import pybind11
import os

OPENDXA_ROOT = os.path.abspath('../../opendxa')
BUILD_DIR = os.path.join(OPENDXA_ROOT, 'build')
INCLUDE_DIR = os.path.join(OPENDXA_ROOT, 'include')

LIB_PATH = os.path.join(BUILD_DIR, 'libopendxapy.a')
if not os.path.exists(LIB_PATH):
    raise FileNotFoundError(f'Library not found: {LIB_PATH}. Please compile OpenDXA first.')

print(f'Found compiled library (libopendxapy.a): {LIB_PATH}')

ext_modules = [
    Pybind11Extension(
        'opendxa',
        [
            'PyBindModule.cpp',
        ],
        include_dirs=[
            INCLUDE_DIR,
            # OpenGL headers
            '/usr/include/GL',
        ],
        # Usar la librería compilada
        extra_objects=[LIB_PATH],
        libraries=[
            # OpeNGL
            'GL',
            # OpenGL Utility Library
            'GLU',
            # Threading
            'pthread', 
            # Dynamic linking
            'dl',
            # Math
            'm',
            # OpenMP
            'gomp',
        ],
        library_dirs=[
            '/usr/lib/x86_64-linux-gnu',
            '/usr/lib64',
            '/usr/lib',
        ],
        cxx_std=17,
        define_macros=[
            ('VERSION_INFO', '"1.0.0"'),
        ],
        extra_compile_args=[
            '-O3',
            '-march=native',
            '-ffast-math',
            '-fopenmp',
        ],
        extra_link_args=[
            '-fopenmp',
        ],
    )
]

setup(
    name='opendxa',
    version='1.0.0',
    author='Rodolfo Herrera H',
    author_email='contact@rodyherrera.com',
    description='Python bindings for Open Source Dislocation Extraction Algorithm',
    long_description='',
    ext_modules=ext_modules,
    cmdclass={'build_ext': build_ext}
)