import xml.etree.ElementTree as ET
import json

def generate_map(filename="changes.osc", output_file="map.html"):
    try:
        tree = ET.parse(filename)
        root = tree.getroot()
    except Exception as e:
        print(f"Error parsing {filename}: {e}")
        return

    nodes = []
    
    for section in root:
        for elem in section:
            if elem.tag == 'node':
                lat = elem.get('lat')
                lon = elem.get('lon')
                node_id = elem.get('id')
                
                if lat and lon:
                    tags = {}
                    for tag in elem.findall('tag'):
                        tags[tag.get('k')] = tag.get('v')
                    
                    popup_content = f"<b>ID:</b> {node_id}<br>"
                    for k, v in tags.items():
                        popup_content += f"<b>{k}:</b> {v}<br>"
                        
                    nodes.append({
                        "lat": float(lat),
                        "lon": float(lon),
                        "popup": popup_content
                    })

    print(f"Found {len(nodes)} mappable nodes.")

    html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <title>OSC Node Visualization</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin=""/>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin=""></script>
    <style>
        body {{ margin: 0; padding: 0; }}
        #map {{ width: 100%; height: 100vh; }}
    </style>
</head>
<body>
    <div id="map"></div>
    <script>
        var map = L.map('map');
        
        L.tileLayer('https://{{s}}.tile.openstreetmap.org/{{z}}/{{x}}/{{y}}.png', {{
            maxZoom: 19,
            attribution: '© OpenStreetMap contributors'
        }}).addTo(map);

        var nodes = {json.dumps(nodes)};
        var markers = L.layerGroup();

        var bounds = L.latLngBounds();

        nodes.forEach(function(node) {{
            var marker = L.marker([node.lat, node.lon]);
            if (node.popup) {{
                marker.bindPopup(node.popup);
            }}
            markers.addLayer(marker);
            bounds.extend([node.lat, node.lon]);
        }});

        markers.addTo(map);
        
        if (nodes.length > 0) {{
            map.fitBounds(bounds, {{padding: [50, 50]}});
        }} else {{
            map.setView([0, 0], 2);
        }}
    </script>
</body>
</html>
    """

    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(html_content)
    
    print(f"Map generated at {output_file}")

if __name__ == "__main__":
    generate_map()
