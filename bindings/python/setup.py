from pybind11.setup_helpers import Pybind11Extension, build_ext
from pathlib import Path
from setuptools import setup
import numpy
import pybind11

# Get the project root directory
PROJECT_ROOT = Path("/home/rodyherrera/Escritorio/OpenDXA")
OPENDXA_ROOT = PROJECT_ROOT / "opendxa"
OPENDXA_PY_ROOT = Path(__file__).parent / "opendxa_py"

# Define include directories
include_dirs = [
    # OpenDXA core includes
    str(OPENDXA_ROOT / "include"),
    str(OPENDXA_ROOT / "dependencies"),
    str(OPENDXA_ROOT / "dependencies" / "geogram"),
    str(OPENDXA_ROOT / "dependencies" / "ptm"),
    str(OPENDXA_ROOT / "dependencies" / "json" / "include"),
    str(OPENDXA_ROOT / "dependencies" / "pybind11_json" / "include"),
    
    # Python bindings includes
    str(OPENDXA_PY_ROOT / "include"),
    
    # System includes
    "/usr/include/eigen3",
    
    # pybind11 and numpy includes
    pybind11.get_include(),
    numpy.get_include(),
]

# Define library directories
library_dirs = [
    str(OPENDXA_ROOT / "build"),
    str(OPENDXA_ROOT / "build" / "dependencies" / "geogram"),
    str(OPENDXA_ROOT / "build" / "dependencies" / "ptm"),
]

# Define libraries to link
libraries = [
    "CrystalAnalysis",
    "geogram", 
    "PolyhedralTemplateMatching",
]

# Source files for the Python extension
source_files = [
    str(OPENDXA_PY_ROOT / "src" / "main.cpp"),
    str(OPENDXA_PY_ROOT / "src" / "bindings" / "module.cpp"),
    str(OPENDXA_PY_ROOT / "src" / "bindings" / "dislocation_analysis.cpp"),
    str(OPENDXA_PY_ROOT / "src" / "wrappers" / "dislocation_analysis.cpp"),
]

# Compiler flags
extra_compile_args = [
    "-std=c++23",
    "-DWITH_OGR",
    "-DGEOGRAM_WITH_GRAPHICS=OFF",
]

# Linker flags
extra_link_args = [
    "-fopenmp",
]

# Create the extension
ext_modules = [
    Pybind11Extension(
        "opendxa._core",
        source_files,
        include_dirs=include_dirs,
        library_dirs=library_dirs,
        libraries=libraries,
        extra_compile_args=extra_compile_args,
        extra_link_args=extra_link_args,
        cxx_std=23,
    ),
]

setup(
    name="opendxa",
    version="1.0.0",
    description="Open Source Dislocation Extraction Algorithm - Python Bindings",
    author="rodyherrera",
    author_email="contact@rodyherrera.com",
    ext_modules=ext_modules,
    packages=["opendxa", "opendxa.digrat", "opendxa.mesh", "opendxa.stats", "opendxa.utils", "opendxa.visualizers"],
    package_dir={"": "."},
    cmdclass={"build_ext": build_ext},
    zip_safe=False,
    python_requires=">=3.8",
    install_requires=[
        "numpy>=1.20.0",
        "pybind11>=2.10.0",
    ],
)
