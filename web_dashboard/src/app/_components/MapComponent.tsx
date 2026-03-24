"use client";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useState } from "react";
import axios from "axios";

// --- CUSTOM ICONS ---
const createIcon = (color: string) => new L.Icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

const icons: Record<string, L.Icon> = {
    blue: createIcon('blue'),
    red: createIcon('red'),
    green: createIcon('green'),
    black: createIcon('black'),
    grey: createIcon('grey'),
    yellow: createIcon('yellow'),
    orange: createIcon('orange'),
    violet: createIcon('violet'),
    gold: createIcon('gold')
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface MapData {
    reports: any[];
    transit_centers: any[];
    landfills: any[];
    bins: any[];
}

export default function MapComponent() {
    const [isMounted, setIsMounted] = useState(false);
    const [data, setData] = useState<MapData>({ reports: [], transit_centers: [], landfills: [], bins: [] });

    useEffect(() => {
        setIsMounted(true);
        const fetchData = async () => {
            try {
                const token = localStorage.getItem("token");
                const headers = token ? { Authorization: `Bearer ${token}` } : {};

                const response = await axios.get(`${API_URL}/admin/map_data`, { headers });
                setData(response.data);
            } catch (err: any) {
                console.error("Error fetching map data", err);
                if (err.response && err.response.status === 401) {
                    window.location.href = "/login";
                }
            }
        };
        fetchData();
    }, []);

    if (!isMounted) {
        return <div className="flex items-center justify-center h-full bg-gray-100 text-gray-500">Chargement de la carte...</div>;
    }

    // Centering on Hanoi instead of Kinshasa
    return (
        <MapContainer center={[21.0285, 105.8542]} zoom={11} style={{ height: "100%", width: "100%" }}>
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* Reports (Bins) - Dynamic Color */}
            {data.reports && data.reports.map((item) => (
                <Marker key={`report-${item.id}`} position={[item.lat, item.lng]} icon={icons[item.color] || icons.red}>
                    <Popup>
                        <strong>Signalement #{item.id}</strong><br />
                        Statut: {item.status}<br />
                        {item.message}
                    </Popup>
                </Marker>
            ))}

            {/* Transit Centers - Brown (gold) or Red if full */}
            {data.transit_centers && data.transit_centers.map((item) => {
                let tcColor = "gold"; // Brownish
                if (item.status === 'FULL') tcColor = "red";
                else if (item.status === 'EMERGENCY') tcColor = "violet";

                return (
                    <Marker key={`tc-${item.id}`} position={[item.lat, item.lng]} icon={icons[tcColor] || icons.blue}>
                        <Popup>
                            <strong>Centre de Transit</strong><br />
                            Nom: {item.name}<br />
                            Statut: {item.status}
                        </Popup>
                    </Marker>
                );
            })}

            {/* Landfills - BLACK */}
            {data.landfills && data.landfills.map((item) => (
                <Marker key={`landfill-${item.id}`} position={[item.lat, item.lng]} icon={icons[item.color] || icons.black}>
                    <Popup>
                        <strong>Centre d'Enfouissement</strong><br />
                        Nom: {item.name}<br />
                        Statut: {item.status}
                    </Popup>
                </Marker>
            ))}

            {/* Official Bins - GREEN */}
            {data.bins && data.bins.map((item) => (
                <Marker key={`bin-${item.id}`} position={[item.lat, item.lng]} icon={icons.green}>
                    <Popup>
                        <strong>Poubelle Publique</strong><br />
                        ID: {item.osm_id}<br />
                        Statut: {item.status}
                    </Popup>
                </Marker>
            ))}
        </MapContainer>
    );
}
