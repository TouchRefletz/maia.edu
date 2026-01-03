import json
import sys
import os

def main():
    manifest_path = os.environ.get("MANIFEST_PATH")
    
    # Support both single FILENAME and batched FILENAMES_JSON
    targets = set()
    
    single_target = os.environ.get("FILENAME")
    if single_target and single_target != "null":
        targets.add(single_target)
        
    json_targets = os.environ.get("FILENAMES_JSON")
    if json_targets and json_targets != "null":
        try:
            parsed = json.loads(json_targets)
            if isinstance(parsed, list):
                for t in parsed:
                    if t: targets.add(t)
        except Exception as e:
            print(f"Erro ao parsear FILENAMES_JSON: {e}")

    if not manifest_path:
        print("Erro: MANIFEST_PATH é obrigatório.")
        sys.exit(1)
        
    if not targets:
        print("Nenhum arquivo especificado para remoção (FILENAME ou FILENAMES_JSON vazios).")
        # Exit gracefully, maybe just a sync run?
        sys.exit(0)

    try:
        if not os.path.exists(manifest_path):
             print(f"Manifesto não encontrado em {manifest_path}")
             sys.exit(1)

        with open(manifest_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        # Pre-process targets for flexible matching
        target_bases = set()
        for t in targets:
            base = t.replace("files/", "") if t.startswith("files/") else t
            target_bases.add(base)
        
        print(f"Alvos para remoção ({len(targets)}): {list(targets)}")

        # Helper to calculate new list
        items = []
        is_wrapped = False
        
        if isinstance(data, list):
            items = data
        elif isinstance(data, dict) and "results" in data:
            items = data["results"]
            is_wrapped = True
        elif isinstance(data, dict) and "files" in data:
            items = data["files"]
            is_wrapped = True
        
        # Filter Logic
        start_len = len(items)
        filtered_items = []
        
        for item in items:
            # Check various filename properties
            fname = item.get("filename", "")
            # Also check 'link' or 'url' fields for references
            link = item.get("link", "")
            link_origem = item.get("link_origem", "")
            url_source = item.get("url_source", "")
            
            path = item.get("path", "")
            
            # Match Logic
            # Check if ANY of the item's properties match ANY of the targets
            is_match = False
            
            # Simple check against set
            candidates = [fname, link, link_origem, url_source, path]
            
            for c in candidates:
                if not c: continue
                # Exact match
                if c in targets:
                    is_match = True
                    break
                # Base match
                c_base = c.replace("files/", "") if c.startswith("files/") else c
                if c_base in target_bases:
                    is_match = True
                    break
            
            if is_match:
                print(f"REMOVENDO entrada do manifesto: {fname or link} (Match encontrado)")
                continue # Skip (Delete)

            filtered_items.append(item)
        
        end_len = len(filtered_items)
        print(f"Total itens antes: {start_len}, depois: {end_len}")

        if is_wrapped:
            data["results"] = filtered_items # Maintain wrapper structure if used
            final_json = data
        else:
            final_json = filtered_items

        with open(manifest_path, "w", encoding="utf-8") as f:
            json.dump(final_json, f, indent=2, ensure_ascii=False)
            
    except Exception as e:
        print(f"Erro ao processar manifesto: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
