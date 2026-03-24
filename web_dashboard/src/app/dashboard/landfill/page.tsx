"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { Trash2, MapPin, Activity } from "lucide-react";

// Types
interface Landfill {
    id: number;
    name: string;
    status: string; // OPERATIONAL, FULL
    lat: number;
    lng: number;
    current_load?: number;
    supervisor_id?: number;
    supervisor_name?: string;
}

const API_URL = "http://127.0.0.1:8000"; // Force 127.0.0.1

export default function LandfillPage() {
    const [landfills, setLandfills] = useState<Landfill[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [supervisors, setSupervisors] = useState<{ id: number; username: string }[]>([]);

    useEffect(() => {
        const fetchLandfills = async () => {
            try {
                const token = localStorage.getItem("token");
                const headers = token ? { Authorization: `Bearer ${token}` } : {};

                const response = await axios.get(`${API_URL}/admin/map_data`, { headers });
                setLandfills(response.data.landfills || []);

                // Fetch Users to filter Supervisors
                const usersRes = await axios.get(`${API_URL}/admin/users`, { headers });
                const supsList = usersRes.data.filter((u: any) => u.role === 'SUPERVISEUR' || u.role === 'SUPERVISOR');
                setSupervisors(supsList);

                setLoading(false);
            } catch (err: any) {
                console.error("Error fetching landfill data", err);
                setError("Impossible de charger les centres d'enfouissement.");
                setLoading(false);
                if (err.response && err.response.status === 401) {
                    window.location.href = "/login";
                }
            }
        };

        fetchLandfills();
    }, []);

    const handleAssign = async (centerId: number, supervisorId: string) => {
        try {
            const token = localStorage.getItem("token");
            const payload = supervisorId === "unassign" ? { supervisor_id: null } : { supervisor_id: parseInt(supervisorId) };

            await axios.put(`${API_URL}/admin/landfill/${centerId}/assign`,
                payload,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            // Update local state
            setLandfills(landfills.map(c =>
                c.id === centerId
                    ? { ...c, supervisor_name: supervisorId === "unassign" ? undefined : supervisors.find(s => s.id === parseInt(supervisorId))?.username, supervisor_id: supervisorId === "unassign" ? undefined : parseInt(supervisorId) }
                    : c
            ));
            alert(supervisorId === "unassign" ? "Désassignation réussie !" : "Superviseur assigné !");
        } catch (err) {
            console.error("Assignment failed", err);
            alert("Erreur lors de l'opération");
        }
    };

    if (loading) return <div className="p-8 text-center">Chargement des centres d'enfouissement...</div>;
    if (error) return <div className="p-8 text-center text-red-500">{error}</div>;

    return (
        <div className="p-8 space-y-6 bg-gray-50 min-h-screen">
            <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                <Trash2 className="mr-3 h-8 w-8 text-red-600" />
                Gestion des Centres d'Enfouissement
            </h1>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {landfills.map((landfill) => (
                    <div key={landfill.id} className="bg-white shadow rounded-lg p-6 border-l-4 border-red-500">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h2 className="text-xl font-semibold text-gray-800">{landfill.name}</h2>
                                <p className="text-sm text-gray-500">ID: {landfill.id}</p>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${landfill.status === 'OPERATIONAL' ? 'bg-green-100 text-green-800' :
                                landfill.status === 'FULL' ? 'bg-red-100 text-red-800' :
                                    'bg-yellow-100 text-yellow-800'
                                }`}>
                                {landfill.status}
                            </span>
                        </div>

                        <div className="space-y-2 text-sm text-gray-600">
                            <div className="flex items-center">
                                <MapPin className="mr-2 h-4 w-4" />
                                {landfill.lat.toFixed(6)}, {landfill.lng.toFixed(6)}
                            </div>
                            <div className="flex items-center">
                                <Activity className="mr-2 h-4 w-4" />
                                Capacité: Grande (10000t)
                            </div>
                            <div className="flex items-center pt-2">
                                <span className="text-gray-700 mr-2 font-medium">Superviseur:</span>
                                <select
                                    className="border border-gray-300 rounded-md shadow-sm text-sm p-1 max-w-[150px]"
                                    value={landfill.supervisor_id || ""}
                                    onChange={(e) => handleAssign(landfill.id, e.target.value)}
                                >
                                    <option value="" disabled>Choisir...</option>
                                    <option value="unassign">-- Désassigner --</option>
                                    {supervisors.map(sup => (
                                        <option key={sup.id} value={sup.id}>{sup.username}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="mt-4 pt-4 border-t border-gray-100 flex justify-end space-x-2">
                            <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                                Voir détails
                            </button>
                            <button className="text-gray-600 hover:text-gray-800 text-sm font-medium">
                                Modifier
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {landfills.length === 0 && (
                <div className="text-center py-10 text-gray-500">
                    Aucun centre d'enfouissement trouvé.
                </div>
            )}
        </div>
    );
}
