"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { AlertTriangle, CheckCircle, Truck, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

const API_URL = "http://127.0.0.1:8000"; // Force 127.0.0.1


interface Stats {
    total: number;
    illegal: number;
    open: number;
    cleaned: number;
}

export default function DashboardPage() {
    const [stats, setStats] = useState<Stats | null>(null);
    const [recentActivity, setRecentActivity] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const token = localStorage.getItem("token");
                console.log("Fetching dashboard data with token:", token ? "Present" : "Missing");
                const headers = { Authorization: `Bearer ${token}` };

                // Fetch Stats
                console.log("GET", `${API_URL}/admin/stats`);
                const statsRes = await axios.get(`${API_URL}/admin/stats`, { headers });
                setStats(statsRes.data);

                // Fetch Recent Reports for Activity Feed (Limit to 5)
                const reportsRes = await axios.get(`${API_URL}/admin/reports`, { headers });
                setRecentActivity(reportsRes.data.slice(0, 5));

            } catch (err: any) {
                console.error("Error fetching dashboard data", err);
                if (err.response && err.response.status === 401) {
                    window.location.href = "/login";
                }
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    if (loading) return <div className="p-8">Chargement des statistiques...</div>;

    return (
        <div>
            <h2 className="text-2xl font-bold mb-6 text-gray-800">Vue d'ensemble</h2>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {/* Card 1: Total Signalements */}
                <div className="overflow-hidden rounded-lg bg-white shadow">
                    <div className="p-5">
                        <div className="flex items-center">
                            <div className="flex-shrink-0">
                                <AlertTriangle className="h-6 w-6 text-gray-400" />
                            </div>
                            <div className="ml-5 w-0 flex-1">
                                <dl>
                                    <dt className="truncate text-sm font-medium text-gray-500">Total Signalements</dt>
                                    <dd>
                                        <div className="text-lg font-medium text-gray-900">{stats?.total || 0}</div>
                                    </dd>
                                </dl>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Card 2: Dépôts Illégaux */}
                <div className="overflow-hidden rounded-lg bg-white shadow">
                    <div className="p-5">
                        <div className="flex items-center">
                            <div className="flex-shrink-0">
                                <AlertTriangle className="h-6 w-6 text-red-500" />
                            </div>
                            <div className="ml-5 w-0 flex-1">
                                <dl>
                                    <dt className="truncate text-sm font-medium text-gray-500">Dépôts Illégaux</dt>
                                    <dd>
                                        <div className="text-lg font-medium text-gray-900">{stats?.illegal || 0}</div>
                                    </dd>
                                </dl>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Card 3: Validés */}
                <div className="overflow-hidden rounded-lg bg-white shadow">
                    <div className="p-5">
                        <div className="flex items-center">
                            <div className="flex-shrink-0">
                                <CheckCircle className="h-6 w-6 text-green-500" />
                            </div>
                            <div className="ml-5 w-0 flex-1">
                                <dl>
                                    <dt className="truncate text-sm font-medium text-gray-500">Nettoyés & Validés</dt>
                                    <dd>
                                        <div className="text-lg font-medium text-gray-900">{stats?.cleaned || 0}</div>
                                    </dd>
                                </dl>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Card 4: En cours */}
                <div className="overflow-hidden rounded-lg bg-white shadow">
                    <div className="p-5">
                        <div className="flex items-center">
                            <div className="flex-shrink-0">
                                <Clock className="h-6 w-6 text-yellow-500" />
                            </div>
                            <div className="ml-5 w-0 flex-1">
                                <dl>
                                    <dt className="truncate text-sm font-medium text-gray-500">En cours</dt>
                                    <dd>
                                        <div className="text-lg font-medium text-gray-900">{stats?.open || 0}</div>
                                    </dd>
                                </dl>
                            </div>
                        </div>
                    </div>
                </div>

            </div>

            {/* Recent Activity Table */}
            <div className="mt-8">
                <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">Activité Récente</h3>
                <div className="bg-white shadow overflow-hidden sm:rounded-md">
                    <ul role="list" className="divide-y divide-gray-200">
                        {recentActivity.length > 0 ? recentActivity.map((activity) => (
                            <li key={activity.id}>
                                <div className="px-4 py-4 sm:px-6 hover:bg-gray-50 transition duration-150 ease-in-out">
                                    <div className="flex items-center justify-between">
                                        <div className="text-sm font-medium text-blue-600 truncate">
                                            {activity.type === 'REPORT' ? `Signalement #${activity.id}` : `Tâche #${activity.id}`}
                                        </div>
                                        <div className="ml-2 flex-shrink-0 flex">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${activity.status === 'CLEANED' ? 'bg-green-100 text-green-800' :
                                                activity.status === 'ILLEGAL_DUMP' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                                                }`}>
                                                {activity.status}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="mt-2 sm:flex sm:justify-between">
                                        <div className="sm:flex">
                                            <p className="flex items-center text-sm text-gray-500">
                                                {activity.message || "Nouveau signalement détecté"}
                                            </p>
                                        </div>
                                        <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                                            <Clock className="flex-shrink-0 mr-1.5 h-4 w-4 text-gray-400" />
                                            <p>
                                                {new Date(activity.created_at).toLocaleDateString()}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </li>
                        )) : (
                            <li className="px-4 py-4 sm:px-6 text-center text-gray-500">Aucune activité récente.</li>
                        )}
                    </ul>
                </div>
            </div>
        </div>
    );
}
