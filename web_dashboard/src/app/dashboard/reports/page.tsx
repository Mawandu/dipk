"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { AlertTriangle, MapPin, Calendar, User, Eye, Download } from "lucide-react";
import Link from "next/link";

const API_URL = "http://127.0.0.1:8000"; // Force 127.0.0.1

interface Report {
    id: number;
    status: string;
    message: string;
    location: { latitude: number; longitude: number };
    created_at: string;
    image_url: string;
    assigned_agent: string | null;
}

export default function ReportsPage() {
    const [reports, setReports] = useState<Report[]>([]);
    const [loading, setLoading] = useState(true);

    const [agents, setAgents] = useState<{ id: number; username: string }[]>([]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const token = localStorage.getItem("token");
                const headers = { Authorization: `Bearer ${token}` };

                // Fetch Reports
                const reportsRes = await axios.get(`${API_URL}/admin/reports`, { headers });
                setReports(reportsRes.data);

                // Fetch Users to filter Agents
                const usersRes = await axios.get(`${API_URL}/admin/users`, { headers });
                const agentsList = usersRes.data.filter((u: any) => u.role === 'AGENT' || u.role === 'INSPECTEUR');
                setAgents(agentsList);

            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const handleAssign = async (reportId: number, agentId: string) => {
        try {
            const token = localStorage.getItem("token");
            const payload = agentId === "unassign" ? { agent_id: null } : { agent_id: parseInt(agentId) };

            await axios.put(`${API_URL}/admin/reports/${reportId}/assign`,
                payload,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            // Update local state
            setReports(reports.map(r =>
                r.id === reportId
                    ? { ...r, assigned_agent: agentId === "unassign" ? null : agents.find(a => a.id === parseInt(agentId))?.username || null }
                    : r
            ));
            alert(agentId === "unassign" ? "Désassignation réussie !" : "Assignation réussie !");
        } catch (err) {
            console.error("Assignment failed", err);
            alert("Erreur lors de l'opération");
        }
    };

    const downloadCSV = () => {
        if (reports.length === 0) return;

        const headers = ["ID", "Status", "Message", "Latitude", "Longitude", "Date", "Agent"];
        const csvContent = [
            headers.join(","),
            ...reports.map(r => [
                r.id,
                r.status,
                `"${(r.message || "").replace(/"/g, '""')}"`,
                r.location.latitude,
                r.location.longitude,
                r.created_at,
                r.assigned_agent || "Non assigné"
            ].join(","))
        ].join("\n");

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `signalements_export_${new Date().toISOString()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const [selectedImage, setSelectedImage] = useState<string | null>(null);

    // ... existing downloadCSV function ...

    const closeImageModal = () => setSelectedImage(null);

    if (loading) return <div>Chargement des signalements...</div>;

    return (
        <div>
            {/* Sticky Image Modal */}
            {selectedImage && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4" onClick={closeImageModal}>
                    <div className="relative max-w-4xl w-full max-h-screen flex items-center justify-center">
                        <img
                            src={selectedImage}
                            alt="Full size report"
                            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
                            onClick={(e) => e.stopPropagation()} // Prevent closing when clicking the image
                        />
                        <button
                            className="absolute top-4 right-4 bg-white text-black rounded-full p-2 hover:bg-gray-200 transition"
                            onClick={closeImageModal}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>
            )}

            {/* Sticky Header */}
            <div className="sticky top-0 z-10 bg-gray-50 pb-4 pt-2 border-b border-gray-200 mb-6 flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-800">Historique des Signalements</h2>
                <button
                    onClick={downloadCSV}
                    className="flex items-center px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
                >
                    <Download className="w-4 h-4 mr-2" />
                    Exporter Excel (CSV)
                </button>
            </div>

            <div className="grid gap-4">
                {reports.map((report) => (
                    <div key={report.id} className="bg-white p-4 rounded-lg shadow flex flex-col md:flex-row gap-4 items-start md:items-center border border-gray-100 hover:border-blue-300 transition-colors">
                        {/* Image */}
                        <div className="h-24 w-24 flex-shrink-0 rounded-md bg-gray-100 overflow-hidden relative group cursor-pointer" onClick={() => report.image_url && setSelectedImage(`${API_URL}${report.image_url}`)}>
                            {report.image_url ? (
                                <img src={`${API_URL}${report.image_url}`} alt="Report" className="object-cover h-full w-full group-hover:opacity-75 transition-opacity" />
                            ) : (
                                <div className="flex items-center justify-center h-full text-gray-400">
                                    <AlertTriangle />
                                </div>
                            )}
                        </div>

                        {/* Content */}
                        <div className="flex-1">
                            <div className="flex items-center justify-between mb-1">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium 
                             ${report.status === 'CLEANED' ? 'bg-green-100 text-green-800' :
                                        report.status === 'ILLEGAL_DUMP' ? 'bg-red-100 text-red-800' :
                                            'bg-yellow-100 text-yellow-800'}`}>
                                    {report.status}
                                </span>
                                <span className="text-xs text-gray-400 flex items-center">
                                    <Calendar className="w-3 h-3 mr-1" />
                                    {new Date(report.created_at).toLocaleString()}
                                </span>
                            </div>
                            <p className="text-gray-900 font-medium">{report.message || "Aucune description"}</p>
                            <div className="mt-2 flex items-center text-sm text-gray-500 gap-4">
                                <span className="flex items-center">
                                    <MapPin className="w-3 h-3 mr-1" />
                                    Lat: {report.location.latitude.toFixed(4)}, Lon: {report.location.longitude.toFixed(4)}
                                </span>
                                {report.assigned_agent && (
                                    <span className="flex items-center text-blue-600">
                                        <User className="w-3 h-3 mr-1" />
                                        Assigné à :
                                        <select
                                            className="ml-2 border-gray-300 rounded-md shadow-sm text-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50"
                                            value={agents.find(a => a.username === report.assigned_agent)?.id || ""}
                                            onChange={(e) => handleAssign(report.id, e.target.value)}
                                        >
                                            <option value="" disabled>Choisir un agent</option>
                                            <option value="unassign" className="text-red-500 font-bold">-- Désassigner --</option>
                                            {agents.map(agent => (
                                                <option key={agent.id} value={agent.id}>{agent.username}</option>
                                            ))}
                                        </select>
                                    </span>
                                )}
                                {!report.assigned_agent && (
                                    <span className="flex items-center text-gray-500">
                                        <User className="w-3 h-3 mr-1" />
                                        <select
                                            className="ml-2 border border-gray-300 rounded-md shadow-sm text-sm p-1"
                                            value=""
                                            onChange={(e) => handleAssign(report.id, e.target.value)}
                                        >
                                            <option value="" disabled>Assigner à...</option>
                                            {agents.map(agent => (
                                                <option key={agent.id} value={agent.id}>{agent.username}</option>
                                            ))}
                                        </select>
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Actions */}
                        <div>
                            <button
                                className="text-gray-400 hover:text-blue-600 transition-colors"
                                onClick={() => report.image_url && setSelectedImage(`${API_URL}${report.image_url}`)}
                                title="Voir l'image en grand"
                            >
                                <Eye className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
