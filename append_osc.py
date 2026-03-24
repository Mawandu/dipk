import xml.etree.ElementTree as ET
import os

def append_osc(base_file="changes.osc", append_file="changes(10).osc"):
    if not os.path.exists(append_file):
        print(f"File {append_file} not found.")
        return

    try:
        base_tree = ET.parse(base_file)
        base_root = base_tree.getroot()
        
        append_tree = ET.parse(append_file)
        append_root = append_tree.getroot()
    except Exception as e:
        print(f"Error parsing XML: {e}")
        return
    def get_section(root, tag):
        sec = root.find(tag)
        if sec is None:
            sec = ET.SubElement(root, tag)
        return sec

    for tag in ['create', 'modify', 'delete']:
        append_sec = append_root.find(tag)
        if append_sec is not None and len(append_sec) > 0:
            base_sec = get_section(base_root, tag)
            for child in append_sec:
                base_sec.append(child)

    ET.indent(base_tree, space="  ", level=0)
    base_tree.write(base_file, encoding='utf-8', xml_declaration=True)
    print(f"Appended {append_file} to {base_file}")

if __name__ == "__main__":
    append_osc()
