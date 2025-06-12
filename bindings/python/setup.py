from setuptools import setup, find_packages
from pybind11.setup_helpers import Pybind11Extension, build_ext
from pybind11 import get_cmake_dir
import pybind11
import os
import shutil
from pathlib import Path

# Get absolute paths to avoid relative path issues
CURRENT_DIR = os.path.abspath(os.path.dirname(__file__))
OPENDXA_PY_ROOT = CURRENT_DIR
OPENDXA_ROOT = os.path.abspath(os.path.join(CURRENT_DIR, '../../opendxa'))

lib_dir = os.path.join(OPENDXA_PY_ROOT, 'lib')
if not os.path.exists(lib_dir):
    os.makedirs(lib_dir)

INCLUDE_DIR = os.path.join(OPENDXA_ROOT, 'include')
SRC_DIR = os.path.join(OPENDXA_ROOT, 'src')

def find_cpp_files_recursive(directory, exclude_patterns=None):
    if exclude_patterns is None:
        exclude_patterns = []
    
    cpp_files = []
    
    if not os.path.exists(directory):
        print(f"Warning: Directory {directory} does not exist")
        return cpp_files
    
    directory_path = Path(directory)
    
    for cpp_file in directory_path.rglob("*.cpp"):
        file_name = cpp_file.name
        
        should_exclude = False
        for pattern in exclude_patterns:
            if pattern in file_name or pattern in str(cpp_file):
                should_exclude = True
                break
        
        if not should_exclude:
            cpp_files.append(str(cpp_file))
            print(f"  Found: {os.path.relpath(str(cpp_file), CURRENT_DIR)}")
        else:
            print(f"  Excluded: {os.path.relpath(str(cpp_file), CURRENT_DIR)}")
    
    return cpp_files

class CustomBuildExt(build_ext):
    def build_extension(self, ext):
        # Create a local copy of source files to avoid path issues
        build_temp = self.build_temp
        source_dir = os.path.join(build_temp, 'sources')
        
        if os.path.exists(source_dir):
            shutil.rmtree(source_dir)
        os.makedirs(source_dir)
        
        # Copy source files to build directory with flattened structure
        new_sources = []
        source_map = {}
        
        for i, source in enumerate(ext.sources):
            if os.path.isabs(source):
                source_file = source
            else:
                source_file = os.path.join(CURRENT_DIR, source)
            
            if not os.path.exists(source_file):
                print(f"Warning: Source file not found: {source_file}")
                continue
                
            # Create a unique filename to avoid conflicts
            base_name = os.path.basename(source_file)
            name, ext_suffix = os.path.splitext(base_name)
            new_name = f"{i:03d}_{name}{ext_suffix}"
            new_path = os.path.join(source_dir, new_name)
            
            shutil.copy2(source_file, new_path)
            new_sources.append(new_path)
            source_map[source] = new_path
            
        # Update extension sources
        ext.sources = new_sources
        
        # Call parent build_extension
        super().build_extension(ext)

def collect_cpp_files():
    print("=== Scanning for C++ source files ===\n")
    
    all_cpp_files = []
    
    print("1. Scanning OpenDXA core source files...")
    core_exclude_patterns = [
        'main.cpp',
    ]
    
    core_files = find_cpp_files_recursive(SRC_DIR, core_exclude_patterns)
    all_cpp_files.extend(core_files)
    print(f"   -> Found {len(core_files)} core files\n")
    
    print("2. Scanning Python binding files...")
    bindings_dir = os.path.join(OPENDXA_PY_ROOT, 'opendxa_py', 'src')
    if os.path.exists(bindings_dir):
        binding_files = find_cpp_files_recursive(bindings_dir)
        all_cpp_files.extend(binding_files)
        print(f"   -> Found {len(binding_files)} binding files\n")
    else:
        print(f"   -> Bindings directory not found: {bindings_dir}\n")
    
    # Remove duplicates while preserving order
    seen = set()
    unique_files = []
    for file in all_cpp_files:
        normalized_path = os.path.normpath(file)
        if normalized_path not in seen:
            seen.add(normalized_path)
            unique_files.append(normalized_path)
    
    return unique_files

def get_include_dirs():
    include_dirs = [
        INCLUDE_DIR,
        OPENDXA_PY_ROOT,
        os.path.join(OPENDXA_ROOT, 'dependencies', 'cxxopts', 'include'),
        SRC_DIR,
        os.path.join(OPENDXA_PY_ROOT, 'opendxa_py', 'include'),
    ]
    
    system_includes = [
        '/usr/include/GL',
        '/usr/include/eigen3',
        '/usr/include/opencv4',
        '/usr/local/include',
        '/opt/local/include',
    ]
    
    for sys_include in system_includes:
        if os.path.exists(sys_include):
            include_dirs.append(sys_include)
    
    return include_dirs

def get_libraries():
    base_libraries = [
        'pthread',
        'dl',
        'm',
    ]
    
    optional_libraries = [
        ('GL', ['/usr/lib/x86_64-linux-gnu/libGL.so', '/usr/lib64/libGL.so']),
        ('GLU', ['/usr/lib/x86_64-linux-gnu/libGLU.so', '/usr/lib64/libGLU.so']),
        ('gomp', ['/usr/lib/x86_64-linux-gnu/libgomp.so', '/usr/lib64/libgomp.so']),
    ]
    
    libraries = base_libraries.copy()
    
    for lib_name, lib_paths in optional_libraries:
        lib_found = any(os.path.exists(path) for path in lib_paths)
        if lib_found:
            libraries.append(lib_name)
            print(f"   -> Found library: {lib_name}")
        else:
            print(f"   -> Library not found: {lib_name} (optional)")
    
    return libraries

def get_library_dirs():
    potential_lib_dirs = [
        '/usr/lib/x86_64-linux-gnu',
        '/usr/lib64',
        '/usr/lib',
        '/usr/local/lib',
        '/opt/local/lib',
        '/lib/x86_64-linux-gnu',
        '/lib64',
    ]
    
    existing_lib_dirs = []
    for lib_dir in potential_lib_dirs:
        if os.path.exists(lib_dir):
            existing_lib_dirs.append(lib_dir)
    
    return existing_lib_dirs

print("=" * 60)
print("OpenDXA Python Build Configuration")
print("=" * 60)
print(f"Current Directory: {CURRENT_DIR}")
print(f"OpenDXA Root: {OPENDXA_ROOT}")
print(f"OpenDXA Python Root: {OPENDXA_PY_ROOT}")
print()

cpp_files = collect_cpp_files()
include_dirs = get_include_dirs()
libraries = get_libraries()
library_dirs = get_library_dirs()

print("=" * 60)
print("BUILD SUMMARY")
print("=" * 60)
print(f"Total C++ files: {len(cpp_files)}")
print(f"Include directories: {len(include_dirs)}")
print(f"Libraries: {len(libraries)}")
print(f"Library directories: {len(library_dirs)}")
print()

print("Files to compile:")
for i, file in enumerate(cpp_files, 1):
    rel_path = os.path.relpath(file, CURRENT_DIR)
    print(f"  {i:2d}. {rel_path}")

print()
print("Include directories:")
for i, inc_dir in enumerate(include_dirs, 1):
    exists = "✓" if os.path.exists(inc_dir) else "✗"
    rel_path = os.path.relpath(inc_dir, CURRENT_DIR) if not inc_dir.startswith('/usr/') else inc_dir
    print(f"  {i:2d}. {exists} {rel_path}")

print()
print("Libraries:", ", ".join(libraries))
print("=" * 60)

ext_modules = [
    Pybind11Extension(
        'lib._core',
        cpp_files, 
        include_dirs=include_dirs,
        libraries=libraries,
        library_dirs=library_dirs,
        cxx_std=17,
        extra_compile_args=[
            '-O3',
            '-march=native',
            '-ffast-math',
            '-fopenmp',
            '-fPIC',
            '-Wall',
            '-Wextra',
            '-Wno-unused-parameter',
            '-Wno-unused-variable',
            '-Wno-sign-compare',
        ],
        extra_link_args=[
            '-fopenmp',
        ],
    )
]

setup(
    name='opendxa',
    version='1.0.0',
    packages=['lib'], 
    package_dir={'lib': 'lib'}, 
    author='rodyherrera',
    author_email='contact@rodyherrera.com',
    description='Open Source Dislocation Extraction Algorithm',
    ext_modules=ext_modules,
    cmdclass={'build_ext': CustomBuildExt},
    python_requires='>=3.8',
    install_requires=[
        'numpy>=1.20.0',
        'pybind11>=2.10.0',
    ],
    setup_requires=[
        'pybind11>=2.10.0',
    ]
)