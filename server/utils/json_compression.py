#
# Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
#
# Permission is hereby granted, free of charge, to any person obtaining a copy
# of this software and associated documentation files (the "Software"), to deal
# in the Software without restriction, including without limitation the rights
# to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
# copies of the Software, and to permit persons to whom the Software is
# furnished to do so, subject to the following conditions:
#
# The above copyright notice and this permission notice shall be included in all
# copies or substantial portions of the Software.
#
# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
# IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
# FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
# AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
# LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
# OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
# SOFTWARE.
#

from typing import List, Tuple
from pathlib import Path
import zstandard as zstd
import concurrent.futures
import multiprocessing
import logging
import json

logger = logging.getLogger(__name__)

def compress_single_json_file(json_file_path: str, output_dir: str) -> Tuple[bool, str, str]:
    try:
        json_file = Path(json_file_path)
        output_path = Path(output_dir)

        logger.info(f"Compressing JSON {json_file.name}")

        try:
            with open(json_file, 'r', encoding='utf-8') as f:
                json_content = f.read()

            if not json_content:
                raise Exception("File content is empty")

        except Exception as e:
            raise Exception(f"Failed to read file: {e}")

        json_content = json_content.strip()

        if not json_content.startswith('{'):
            raise Exception(f"JSON doesn't start with '{{'. Starts with: '{json_content[:100]}'")
        if not json_content.endswith('}'):
            raise Exception(f"JSON doesn't end with '}}'. Ends with: '{json_content[-100:]}'")

        try:
            json_data = json.loads(json_content)
        except json.JSONDecodeError as e:
            raise Exception(f"JSON parsing failed: {e}")

        try:
            json_str = json.dumps(
                json_data,
                separators=(',', ':'),
                ensure_ascii=False,
                check_circular=True,
                allow_nan=False
            )
            test_parse = json.loads(json_str)
        except Exception as e:
            raise Exception(f"JSON reserialization failed: {e}")

        try:
            json_bytes = json_str.encode('utf-8')
        except UnicodeEncodeError as e:
            raise Exception(f"UTF-8 encoding failed: {e}")

        timestep = json_file.stem.replace('timestep_', '')
        output_file = output_path / f"{timestep}.json.zst"

        try:
            cctx = zstd.ZstdCompressor(
                level=6,
                write_checksum=True,
                threads=1,
                write_content_size=True
            )
            compressed_data = cctx.compress(json_bytes)
            if len(compressed_data) == 0:
                raise Exception("Compression produced empty result")
        except Exception as e:
            raise Exception(f"ZSTD compression failed: {e}")

        try:
            with open(output_file, 'wb') as f:
                f.write(compressed_data)

            written_size = output_file.stat().st_size
            if written_size != len(compressed_data):
                raise Exception(f"File size mismatch: expected {len(compressed_data)}, got {written_size}")
        except Exception as e:
            raise Exception(f"Failed to write file: {e}")

        try:
            with open(output_file, 'rb') as f:
                test_compressed = f.read()

            dctx = zstd.ZstdDecompressor()
            test_decompressed = dctx.decompress(test_compressed)

            if test_decompressed != json_bytes:
                raise Exception("Round-trip validation failed")

            test_json_str = test_decompressed.decode('utf-8')
            test_json_data = json.loads(test_json_str)
        except Exception as e:
            if output_file.exists():
                output_file.unlink()
            raise Exception(f"Validation failed: {e}")

        atoms_count = 0
        dislocations_count = 0
        lammps_type_counts = {}

        if 'atoms' in json_data and 'data' in json_data['atoms']:
            atoms_list = json_data['atoms']['data']
            atoms_count = len(atoms_list)
            for atom in atoms_list:
                lt = atom.get('lammps_type', atom.get('atom_type', 'unknown'))
                lammps_type_counts[lt] = lammps_type_counts.get(lt, 0) + 1

        if 'dislocations' in json_data and 'data' in json_data['dislocations']:
            dislocations_count = len(json_data['dislocations']['data'])

        compression_ratio = len(json_bytes) / len(compressed_data)
        type_summary = ', '.join(f"{t}:{c}" for t, c in sorted(lammps_type_counts.items()))

        success_msg = (
            f"✓ {json_file.name} -> {output_file.name} "
            f"(ratio: {compression_ratio:.2f}:1, "
            f"{atoms_count} atoms [{type_summary}], "
            f"{dislocations_count} dislocations)"
        )

        logger.info(f"SUCCESS: {json_file.name} compressed successfully")
        return True, success_msg, str(output_file)

    except Exception as e:
        error_msg = f"✗ Error compressing {json_file_path}: {str(e)}"
        logger.error(error_msg)
        return False, error_msg, ""

def compress_analysis_files_parallel(analysis_dir: str, compressed_dir: str, progress_callback=None) -> List[str]:
    analysis_path = Path(analysis_dir)
    compressed_path = Path(compressed_dir)
    
    compressed_path.mkdir(parents=True, exist_ok=True)
    
    json_files = list(analysis_path.glob('timestep_*.json'))
    
    if not json_files:
        logger.warning(f"No JSON files found in {analysis_dir}")
        return []
    
    logger.info(f"\n=== STARTING CORRECTED COMPRESSION ===")
    logger.info(f"Found {len(json_files)} JSON files to compress")
    logger.info(f"Using read() method instead of json.load() to prevent truncation")
    
    max_workers = min(multiprocessing.cpu_count(), 4)
    logger.info(f"Using {max_workers} parallel workers")
    
    compressed_files = []
    completed_count = 0
    failed_count = 0
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_to_file = {
            executor.submit(compress_single_json_file, str(json_file), str(compressed_path)): json_file
            for json_file in json_files
        }
        
        for future in concurrent.futures.as_completed(future_to_file):
            json_file = future_to_file[future]
            completed_count += 1
            
            try:
                success, message, output_file = future.result()
                
                if success:
                    logger.info(f"[{completed_count}/{len(json_files)}] {message}")
                    compressed_files.append(output_file)
                else:
                    logger.error(f"[{completed_count}/{len(json_files)}] {message}")
                    failed_count += 1
                
                if progress_callback:
                    progress_callback(completed_count, len(json_files), json_file.name)
                    
            except Exception as e:
                failed_count += 1
                error_msg = f"[{completed_count}/{len(json_files)}] ✗ Exception processing {json_file.name}: {e}"
                logger.error(error_msg)
    
    logger.info(f"\n=== COMPRESSION COMPLETE ===")
    logger.info(f"Successfully compressed {len(compressed_files)}/{len(json_files)} files")
    
    if failed_count > 0:
        logger.warning(f"Failed to compress {failed_count} files")
    
    return compressed_files

def get_compression_stats(compressed_dir: str) -> dict:
    compressed_path = Path(compressed_dir)
    
    if not compressed_path.exists():
        return {'total_files': 0, 'total_size': 0, 'total_size_mb': 0, 'files': []}
    
    compressed_files = list(compressed_path.glob('*.json.zst'))
    total_size = sum(f.stat().st_size for f in compressed_files)
    
    return {
        'total_files': len(compressed_files),
        'total_size': total_size,
        'total_size_mb': total_size / (1024 * 1024),
        'files': [f.name for f in compressed_files]
    }

def verify_and_repair_compressed_files(compressed_dir: str) -> List[str]:
    compressed_path = Path(compressed_dir)
    
    if not compressed_path.exists():
        return []
    
    corrupted_files = []
    compressed_files = list(compressed_path.glob('*.json.zst'))
    
    logger.info(f"Verifying {len(compressed_files)} compressed files...")
    
    for compressed_file in compressed_files:
        try:
            if not verify_compressed_file(str(compressed_file)):
                logger.warning(f"Removing corrupted file: {compressed_file}")
                compressed_file.unlink()
                corrupted_files.append(str(compressed_file))
        except Exception as e:
            logger.error(f"Error verifying {compressed_file}: {e}")
            compressed_file.unlink()
            corrupted_files.append(str(compressed_file))
    
    if corrupted_files:
        logger.warning(f"Removed {len(corrupted_files)} corrupted files")
    else:
        logger.info("All compressed files are valid")
    
    return corrupted_files

def verify_compressed_file(compressed_file: str) -> bool:
    try:
        with open(compressed_file, 'rb') as f:
            compressed_data = f.read()
        
        if len(compressed_data) == 0:
            return False
        
        dctx = zstd.ZstdDecompressor()
        decompressed_data = dctx.decompress(compressed_data)
        
        if len(decompressed_data) == 0:
            return False
        
        # Intentar parsear el JSON
        json_str = decompressed_data.decode('utf-8')
        json_data = json.loads(json_str)
        
        return isinstance(json_data, dict)
        
    except Exception:
        return False