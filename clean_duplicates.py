import xml.etree.ElementTree as ET

def clean_duplicates(filename="changes.osc"):
    try:
        tree = ET.parse(filename)
        root = tree.getroot()
    except Exception as e:
        print(f"Error parsing {filename}: {e}")
        return

    seen_ids = set()
    seen_coords = set()
    total_nodes = 0
    removed_nodes = 0
    
    new_root = ET.Element(root.tag, root.attrib)
    
    for section in root:
        new_section = ET.SubElement(new_root, section.tag, section.attrib)
        
        nodes_to_keep = []
        
        for elem in section:
            if elem.tag == 'node':
                node_id = elem.get('id')
                lat = elem.get('lat')
                lon = elem.get('lon')
                if node_id in seen_ids:
                    removed_nodes += 1
                    continue
                
                is_duplicate_coord = False
                if lat is not None and lon is not None:
                    coord = (lat, lon)
                    if coord in seen_coords:
                        is_duplicate_coord = True
                    else:
                        seen_coords.add(coord)
                
                if is_duplicate_coord:
                    removed_nodes += 1
                    continue
                
                seen_ids.add(node_id)
                nodes_to_keep.append(elem)
                total_nodes += 1
            else:
                nodes_to_keep.append(elem)
        
        for node in nodes_to_keep:
            new_section.append(node)

    new_tree = ET.ElementTree(new_root)
    ET.indent(new_tree, space="  ", level=0)
    new_tree.write(filename, encoding='utf-8', xml_declaration=True)
    
    print(f"Cleanup complete.")
    print(f"Removed {removed_nodes} duplicates.")
    print(f"Total unique nodes remaining: {total_nodes}")

if __name__ == "__main__":
    clean_duplicates()
