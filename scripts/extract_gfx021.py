"""
Extract NPC sprites from gfx021.egf with correct BMP handling.

gfx021.egf contains 4,557 bitmap resources (NPC sprite frames) stored as
16bpp RGB565 BMPs with BI_BITFIELDS compression inside a PE/DLL container.

The standard pefile library has a 4,096 resource entry limit, so this script
uses a custom PE resource directory parser. BMP decoding is handled by Pillow
to ensure correct row-stride padding.

Usage:
    python scripts/extract_gfx021.py <egf_path> [output_dir]

    egf_path    - Path to gfx021.egf
    output_dir  - Output directory for PNGs (default: public/gfx/gfx021)

Dependencies: Pillow (pip install Pillow)
"""
import struct
import os
import sys
from io import BytesIO
from PIL import Image


def parse_pe_resources(data):
    """Parse PE file and extract bitmap resources, bypassing pefile's 4096 limit."""

    if data[:2] != b'MZ':
        raise ValueError("Not a valid PE file")
    pe_offset = struct.unpack_from('<I', data, 0x3C)[0]

    if data[pe_offset:pe_offset+4] != b'PE\x00\x00':
        raise ValueError("Invalid PE signature")

    coff_header = pe_offset + 4
    num_sections = struct.unpack_from('<H', data, coff_header + 2)[0]
    optional_header_size = struct.unpack_from('<H', data, coff_header + 16)[0]
    optional_header = coff_header + 20

    magic = struct.unpack_from('<H', data, optional_header)[0]
    if magic == 0x10b:  # PE32
        data_dir_offset = optional_header + 96
    elif magic == 0x20b:  # PE32+
        data_dir_offset = optional_header + 112
    else:
        raise ValueError(f"Unknown PE magic: {hex(magic)}")

    rsrc_rva = struct.unpack_from('<I', data, data_dir_offset + 8 * 2)[0]

    if rsrc_rva == 0:
        raise ValueError("No resource directory")

    sections_offset = optional_header + optional_header_size
    rsrc_section = None
    for i in range(num_sections):
        sec_offset = sections_offset + i * 40
        sec_rva = struct.unpack_from('<I', data, sec_offset + 12)[0]
        sec_vsize = struct.unpack_from('<I', data, sec_offset + 8)[0]
        sec_raw_offset = struct.unpack_from('<I', data, sec_offset + 20)[0]

        if sec_rva <= rsrc_rva < sec_rva + sec_vsize:
            rsrc_section = {
                'rva': sec_rva,
                'raw_offset': sec_raw_offset,
            }
            break

    if not rsrc_section:
        raise ValueError("Could not find resource section")

    def rva_to_offset(rva):
        return rva - rsrc_section['rva'] + rsrc_section['raw_offset']

    rsrc_base = rva_to_offset(rsrc_rva)

    def parse_resource_dir(offset, level=0):
        num_named = struct.unpack_from('<H', data, offset + 12)[0]
        num_id = struct.unpack_from('<H', data, offset + 14)[0]
        total = num_named + num_id

        entries = []
        for i in range(total):
            entry_offset = offset + 16 + i * 8
            name_or_id = struct.unpack_from('<I', data, entry_offset)[0]
            data_or_dir = struct.unpack_from('<I', data, entry_offset + 4)[0]

            is_dir = (data_or_dir >> 31) & 1
            sub_offset = data_or_dir & 0x7FFFFFFF

            entry_id = name_or_id if not (name_or_id >> 31) else None

            if is_dir:
                sub_entries = parse_resource_dir(rsrc_base + sub_offset, level + 1)
                entries.append((entry_id, sub_entries))
            else:
                data_entry_offset = rsrc_base + sub_offset
                data_rva = struct.unpack_from('<I', data, data_entry_offset)[0]
                data_size = struct.unpack_from('<I', data, data_entry_offset + 4)[0]
                raw_offset = rva_to_offset(data_rva)
                entries.append((entry_id, (raw_offset, data_size)))

        return entries

    root_entries = parse_resource_dir(rsrc_base)

    bitmaps = {}
    for type_id, type_entries in root_entries:
        if type_id != 2:  # RT_BITMAP = 2
            continue
        for res_id, res_entries in type_entries:
            if isinstance(res_entries, list):
                for lang_id, lang_data in res_entries:
                    if isinstance(lang_data, tuple):
                        offset, size = lang_data
                        bitmaps[res_id] = data[offset:offset + size]
            elif isinstance(res_entries, tuple):
                offset, size = res_entries
                bitmaps[res_id] = data[offset:offset + size]

    return bitmaps


def resource_to_png(bmp_data):
    """Convert BMP resource data to transparent PNG using Pillow for correct BMP parsing."""

    # Parse the BITMAPINFOHEADER to determine the pixel data offset
    header_size = struct.unpack_from('<I', bmp_data, 0)[0]
    bpp = struct.unpack_from('<H', bmp_data, 14)[0]
    compression = struct.unpack_from('<I', bmp_data, 16)[0]

    # Calculate the pixel data offset within the DIB data
    # This includes the header + optional color masks or palette
    if bpp <= 8:
        colors_used = struct.unpack_from('<I', bmp_data, 32)[0]
        palette_size = colors_used if colors_used > 0 else (1 << bpp)
        pixel_offset_in_dib = header_size + palette_size * 4
    elif compression == 3:  # BI_BITFIELDS
        pixel_offset_in_dib = header_size + 12  # 3 DWORD color masks
    else:
        pixel_offset_in_dib = header_size

    # Construct a BMP file by prepending BITMAPFILEHEADER (14 bytes)
    data_size = len(bmp_data)
    file_size = 14 + data_size
    bmp_file_header = struct.pack('<2sIHHI',
        b'BM',
        file_size,
        0, 0,
        14 + pixel_offset_in_dib
    )
    bmp_file = bmp_file_header + bmp_data

    # Open with Pillow (handles row stride, 16bpp, etc. correctly)
    img = Image.open(BytesIO(bmp_file)).convert('RGBA')

    # Apply EO transparency: black (0,0,0) → transparent
    pixels = img.load()
    width, height = img.size
    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            if r == 0 and g == 0 and b == 0:
                pixels[x, y] = (0, 0, 0, 0)

    return img


def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/extract_gfx021.py <egf_path> [output_dir]")
        print("  egf_path   - Path to gfx021.egf")
        print("  output_dir - Output directory (default: public/gfx/gfx021)")
        sys.exit(1)

    egf_path = sys.argv[1]
    output_dir = sys.argv[2] if len(sys.argv) > 2 else "public/gfx/gfx021"

    print(f"Reading {egf_path}...")
    with open(egf_path, 'rb') as f:
        data = f.read()

    print("Parsing PE resources...")
    bitmaps = parse_pe_resources(data)
    print(f"Found {len(bitmaps)} bitmap resources")

    os.makedirs(output_dir, exist_ok=True)

    sorted_ids = sorted(bitmaps.keys())
    print(f"Resource ID range: {sorted_ids[0]} - {sorted_ids[-1]}")

    success = 0
    failed = 0
    for res_id in sorted_ids:
        try:
            img = resource_to_png(bitmaps[res_id])
            out_path = os.path.join(output_dir, f"{res_id}.png")
            img.save(out_path, "PNG")
            success += 1
        except Exception as e:
            print(f"  Failed resource {res_id}: {e}")
            failed += 1

    print(f"\nDone! Extracted {success} sprites, {failed} failures")


if __name__ == "__main__":
    main()
