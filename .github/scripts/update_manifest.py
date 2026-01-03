import json
import sys
import os

def main():
    manifest_path = os.environ.get("MANIFEST_PATH")
    target = os.environ.get("FILENAME") # The filename or URL to remove

    if not manifest_path or not target:
        print("Erro: MANIFEST_PATH e FILENAME são obrigatórios.")
        sys.exit(1)

    try:
        if not os.path.exists(manifest_path):
             print(f"Manifesto não encontrado em {manifest_path}")
             sys.exit(1)

        with open(manifest_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        # Handle "files/" prefix if present in target but not in manifest or vice-versa
        target_base = target.replace("files/", "") if target.startswith("files/") else target
        
        print(f"Alvo para remoção (Strict): {target} (Base: {target_base})")

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
            
            # Strict Equality Checks
            # We check both full path and basename to be safe, but NO wildcards/endswith
            is_match = (
                fname == target or 
                fname == target_base or 
                path == target or 
                path == target_base or
                (fname == "files/" + target_base) or
                (path == "files/" + target_base) or
                # Reference Checks (Target might be the URL or a specific ID if we had one, but relying on filename/link match)
                (link == target) or
                (link_origem == target) or
                (url_source == target)
            )
            
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
