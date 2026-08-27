import zipfile
import sys
import json
import os

if len(sys.argv) < 2:
    print("Usage: python3 inspect_wacz.py <path_to_wacz_file>")
    sys.exit(1)

wacz_path = sys.argv[1]
if not os.path.exists(wacz_path):
    print(f"File not found: {wacz_path}")
    sys.exit(1)

try:
    with zipfile.ZipFile(wacz_path, 'r') as z:
        print(f"--- WACZ Contents for {wacz_path} ---")
        files = z.namelist()
        print(f"Total files: {len(files)}")
        
        # 1. Check pages/pages.jsonl
        pages_file = "pages/pages.jsonl"
        if pages_file in files:
            info = z.getinfo(pages_file)
            print(f"\n✅ {pages_file} is present (Size: {info.file_size} bytes)")
            content = z.read(pages_file).decode('utf-8')
            lines = content.strip().split('\n')
            print(f"Number of JSON records: {len(lines)}")
            if len(lines) > 0:
                print("Contents:")
                for i, line in enumerate(lines):
                    print(f"  Line {i+1}: {line}")
            if info.file_size == 0 or len(content.strip()) == 0:
                print(f"❌ {pages_file} is EMPTY!")
        else:
            print(f"\n❌ {pages_file} is MISSING!")
            
        # 2. Check archive/data.warc.gz
        warc_files = [f for f in files if f.startswith('archive/') and f.endswith('.warc.gz')]
        if warc_files:
            for w in warc_files:
                info = z.getinfo(w)
                print(f"\n✅ {w} is present (Size: {info.file_size} bytes)")
        else:
            print("\n❌ archive/data.warc.gz is MISSING!")
            
        # 3. Check indexes
        index_files = [f for f in files if f.startswith('indexes/')]
        if index_files:
            for i in index_files:
                info = z.getinfo(i)
                print(f"\n✅ {i} is present (Size: {info.file_size} bytes)")
                if i.endswith('.cdx') or i.endswith('.cdxj'):
                    content = z.read(i).decode('utf-8')
                    lines = content.strip().split('\n')
                    print(f"Number of CDX records: {len(lines)}")
                    localhost_records = [l for l in lines if 'localhost' in l]
                    if localhost_records:
                        print(f"✅ Found localhost records in {i}:")
                        for lr in localhost_records[:5]:
                            print(f"  {lr}")
                    else:
                        print(f"❌ No localhost records found in {i}.")
        else:
            print("\n❌ indexes/index.cdx is MISSING!")
            
except Exception as e:
    print(f"Error reading WACZ file: {e}")
