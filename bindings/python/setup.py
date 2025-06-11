from setuptools import setup, find_packages
from pybind11.setup_helpers import Pybind11Extension, build_ext
import pybind11
import os

OPENDXA_ROOT = os.path.abspath('../../opendxa')
INCLUDE_DIR = os.path.join(OPENDXA_ROOT, 'include')
SRC_DIR = os.path.join(OPENDXA_ROOT, 'src')

cpp_files = []
for root, dirs, files in os.walk(SRC_DIR):
    for file in files:
        if file.endswith('.cpp') and file != 'Main.cpp':
            cpp_files.append(os.path.join(root, file))

ext_modules = [
    Pybind11Extension(
        'opendxa._core',
        ['PyBindModule.cpp'] + cpp_files,
        include_dirs=[
            INCLUDE_DIR,
            os.path.join(OPENDXA_ROOT, 'dependencies', 'cxxopts', 'include'),
            SRC_DIR,
            '/usr/include/GL',
            '/usr/include/eigen3',
        ],
        libraries=[
            'GL',
            'GLU', 
            'pthread',
            'dl',
            'm',
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
            ('NDEBUG', '1'),
        ],
        extra_compile_args=[
            '-O3',
            '-march=native',
            '-ffast-math',
            '-fopenmp',
            '-fPIC',
            '-Wall',
            '-Wextra',
        ],
        extra_link_args=[
            '-fopenmp',
        ],
    )
]

setup(
    name='opendxa',
    version='1.0.0',
    packages=find_packages(),
    author='rodyherrera',
    author_email='contact@rodyherrera.com',
    description='Open Source Dislocation Extraction Algorithm',
    ext_modules=ext_modules,
    cmdclass={'build_ext': build_ext},
    python_requires='>=3.8',
    install_requires=[
        'numpy>=1.20.0',
        'pybind11>=2.10.0',
    ]
)