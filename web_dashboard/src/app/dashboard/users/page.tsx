"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { Plus, User as UserIcon, Edit2, Trash2, X } from "lucide-react";

const API_URL = "http://127.0.0.1:8000"; // Force 127.0.0.1

interface User {
    id: number;
    username: string;
    role: string;
    full_name: string;
    phone: string;
    password?: string;
}

export default function UsersPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [newUser, setNewUser] = useState({ username: '', password: '', role: 'AGENT', full_name: '', phone: '' });
    const [isCreating, setIsCreating] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);

    // Fetch Users
    const fetchUsers = async () => {
        try {
            const token = localStorage.getItem("token");
            const response = await axios.get(`${API_URL}/admin/users`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setUsers(response.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem("token");
            await axios.post(`${API_URL}/admin/create_user`, newUser, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setIsCreating(false);
            setNewUser({ username: '', password: '', role: 'AGENT', full_name: '', phone: '' });
            fetchUsers(); // Refresh list
        } catch (err) {
            alert("Erreur lors de la création (Vérifiez si l'utilisateur existe déjà)");
        }
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingUser) return;
        try {
            const token = localStorage.getItem("token");
            const payload = { ...editingUser };
            if (!payload.password) delete payload.password; // Ignore empty password

            await axios.put(`${API_URL}/admin/users/${editingUser.id}`, payload, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setEditingUser(null);
            fetchUsers(); // Refresh list
            alert("Utilisateur mis à jour !");
        } catch (err: any) {
            alert("Erreur lors de la modification: " + (err.response?.data?.detail || "Erreur inconnue"));
        }
    };

    const handleDelete = async (userId: number) => {
        if (!window.confirm("Voulez-vous vraiment supprimer cet utilisateur ?")) return;
        try {
            const token = localStorage.getItem("token");
            await axios.delete(`${API_URL}/admin/users/${userId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchUsers(); // Refresh list
            alert("Utilisateur supprimé !");
        } catch (err: any) {
            alert("Erreur lors de la suppression: " + (err.response?.data?.detail || "Erreur inconnue"));
        }
    };

    if (loading) return <div>Chargement...</div>;

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Gestion des Utilisateurs</h2>
                <button
                    onClick={() => { setIsCreating(!isCreating); setEditingUser(null); }}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow"
                >
                    <Plus size={20} />
                    Nouvel Utilisateur
                </button>
            </div>

            {/* Creation Form */}
            {isCreating && (
                <div className="bg-white p-6 rounded-lg shadow mb-8 border border-gray-200">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold">Créer un compte</h3>
                        <button onClick={() => setIsCreating(false)} className="text-gray-500 hover:text-gray-800"><X size={20} /></button>
                    </div>
                    <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input placeholder="Nom d'utilisateur" className="border p-2 rounded" value={newUser.username} onChange={e => setNewUser({ ...newUser, username: e.target.value })} required />
                        <input placeholder="Mot de passe" type="password" className="border p-2 rounded" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} required />
                        <input placeholder="Nom Complet" className="border p-2 rounded" value={newUser.full_name} onChange={e => setNewUser({ ...newUser, full_name: e.target.value })} />
                        <input placeholder="Téléphone" className="border p-2 rounded" value={newUser.phone} onChange={e => setNewUser({ ...newUser, phone: e.target.value })} />
                        <select className="border p-2 rounded" value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })}>
                            <option value="AGENT">AGENT</option>
                            <option value="INSPECTEUR">INSPECTEUR</option>
                            <option value="SUPERVISEUR">SUPERVISEUR</option>
                            <option value="ADMIN">ADMIN</option>
                        </select>
                        <button type="submit" className="bg-green-600 text-white p-2 rounded hover:bg-green-700">Valider</button>
                    </form>
                </div>
            )}

            {/* Edition Form */}
            {editingUser && (
                <div className="bg-yellow-50 p-6 rounded-lg shadow mb-8 border border-yellow-200">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-yellow-800">Modifier l'utilisateur #{editingUser.id}</h3>
                        <button onClick={() => setEditingUser(null)} className="text-gray-500 hover:text-gray-800"><X size={20} /></button>
                    </div>
                    <form onSubmit={handleUpdate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input placeholder="Nom d'utilisateur" className="border p-2 rounded bg-white" value={editingUser.username} onChange={e => setEditingUser({ ...editingUser, username: e.target.value })} required />
                        <input placeholder="Mot de passe (Laisser vide pour ne pas changer)" type="password" className="border p-2 rounded bg-white" value={editingUser.password || ''} onChange={e => setEditingUser({ ...editingUser, password: e.target.value })} />
                        <input placeholder="Nom Complet" className="border p-2 rounded bg-white" value={editingUser.full_name || ''} onChange={e => setEditingUser({ ...editingUser, full_name: e.target.value })} />
                        <input placeholder="Téléphone" className="border p-2 rounded bg-white" value={editingUser.phone || ''} onChange={e => setEditingUser({ ...editingUser, phone: e.target.value })} />
                        <select className="border p-2 rounded bg-white" value={editingUser.role} onChange={e => setEditingUser({ ...editingUser, role: e.target.value })}>
                            <option value="AGENT">AGENT</option>
                            <option value="INSPECTEUR">INSPECTEUR</option>
                            <option value="SUPERVISEUR">SUPERVISEUR</option>
                            <option value="ADMIN">ADMIN</option>
                        </select>
                        <button type="submit" className="bg-yellow-600 text-white p-2 rounded hover:bg-yellow-700">Enregistrer les modifications</button>
                    </form>
                </div>
            )}

            {/* Users List */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Utilisateur</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rôle</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nom Complet</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Téléphone</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {users.map((user) => (
                            <tr key={user.id}>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center">
                                        <div className="flex-shrink-0 h-10 w-10 bg-gray-200 rounded-full flex items-center justify-center">
                                            <UserIcon className="h-5 w-5 text-gray-500" />
                                        </div>
                                        <div className="ml-4">
                                            <div className="text-sm font-medium text-gray-900">{user.username}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                                ${user.role === 'ADMIN' ? 'bg-red-100 text-red-800' :
                                            user.role === 'AGENT' ? 'bg-green-100 text-green-800' :
                                                'bg-blue-100 text-blue-800'}`}>
                                        {user.role}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.full_name}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.phone}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
                                    <button onClick={() => { setEditingUser({ ...user, password: '' }); setIsCreating(false); }} className="text-blue-600 hover:text-blue-900" title="Éditer">
                                        <Edit2 className="w-5 h-5 inline" />
                                    </button>
                                    <button onClick={() => handleDelete(user.id)} className="text-red-600 hover:text-red-900" title="Supprimer">
                                        <Trash2 className="w-5 h-5 inline" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
