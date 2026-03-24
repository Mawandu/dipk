"use client";

import dynamic from "next/dynamic";

const MapComponent = dynamic(() => import("../../_components/MapComponent"), {
    ssr: false,
    loading: () => <p>Chargement de la carte...</p>,
});

export default function MapPage() {
    return (
        <div className="h-[calc(100vh-100px)] w-full rounded-lg overflow-hidden border border-gray-300 shadow-md">
            <MapComponent />
        </div>
    );
}
