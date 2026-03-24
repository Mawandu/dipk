"use client";

import { useState } from "react";
import axios from "axios";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Shield } from "lucide-react";

const API_URL = "http://127.0.0.1:8000"; // Force 127.0.0.1 to avoid localhost issues

export default function LoginPage() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const router = useRouter();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(""); // Clear previous errors
        console.log("Attempting login to:", `${API_URL}/token`);

        try {
            const formData = new URLSearchParams();
            formData.append('username', username);
            formData.append('password', password);

            const response = await fetch(`${API_URL}/token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: formData.toString(),
            });

            console.log("Response status:", response.status);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error("Login error details:", errorData);
                throw new Error(errorData.detail || "Login failed");
            }

            const data = await response.json();
            const { access_token } = data;

            localStorage.setItem("token", access_token);
            localStorage.setItem("username", username);

            console.log("Login successful, redirecting...");
            router.push("/dashboard");
        } catch (err: any) {
            console.error("Login Exception:", err);
            setError(err.message || "Identifiants incorrects");
        }
    };

    return (
        <div className="flex h-screen items-center justify-center bg-gray-900">
            <div className="w-full max-w-md space-y-8 rounded-lg bg-gray-800 p-8 shadow-lg border border-gray-700">
                <div className="text-center">
                    <Shield className="mx-auto h-12 w-12 text-green-500" />
                    <h2 className="mt-6 text-3xl font-bold text-white">Connexion DIPK</h2>
                    <p className="mt-2 text-sm text-gray-400">Accès sécurisé au système</p>
                </div>

                <form className="mt-8 space-y-6" onSubmit={handleLogin}>
                    <div className="space-y-4 rounded-md shadow-sm">
                        <div>
                            <label htmlFor="username" className="sr-only">Nom d'utilisateur</label>
                            <input
                                id="username"
                                name="username"
                                type="text"
                                required
                                className="relative block w-full rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-white placeholder-gray-400 focus:border-green-500 focus:outline-none focus:ring-green-500 sm:text-sm"
                                placeholder="Nom d'utilisateur"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                            />
                        </div>
                        <div>
                            <label htmlFor="password" className="sr-only">Mot de passe</label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                required
                                className="relative block w-full rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-white placeholder-gray-400 focus:border-green-500 focus:outline-none focus:ring-green-500 sm:text-sm"
                                placeholder="Mot de passe"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                    </div>

                    {error && <div className="text-red-500 text-sm text-center">{error}</div>}

                    <div>
                        <button
                            type="submit"
                            className="group relative flex w-full justify-center rounded-md border border-transparent bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                        >
                            Se connecter
                        </button>
                    </div>
                </form>

                <div className="text-center mt-4">
                    <Link href="/" className="text-sm text-gray-400 hover:text-white">
                        ← Retour à l'accueil
                    </Link>
                </div>
            </div>
        </div>
    );
}
