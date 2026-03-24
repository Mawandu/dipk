"use client";

import Link from "next/link";
import { Truck, Map, Shield } from "lucide-react";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-900 text-white p-4">
      <div className="max-w-4xl w-full text-center space-y-8">

        <div className="space-y-2">
          <h1 className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-blue-500">
            DIPK Smart City
          </h1>
          <p className="text-xl text-gray-300">Système Intelligent de Gestion des Déchets pour Kinshasa</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
          {/* Card 1 */}
          <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 hover:border-green-500 transition duration-300">
            <Shield className="w-12 h-12 text-green-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold mb-2">Sécurisé</h3>
            <p className="text-gray-400 text-sm">Accès par rôle : Admin, Superviseur, Agent, Inspecteur.</p>
          </div>

          {/* Card 2 */}
          <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 hover:border-blue-500 transition duration-300">
            <Map className="w-12 h-12 text-blue-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold mb-2">Cartographie</h3>
            <p className="text-gray-400 text-sm">Suivi temps réel des poubelles et camions.</p>
          </div>

          {/* Card 3 */}
          <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 hover:border-yellow-500 transition duration-300">
            <Truck className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold mb-2">Logistique</h3>
            <p className="text-gray-400 text-sm">Optimisation des tournées et gestion des centres de transit.</p>
          </div>
        </div>

        <div className="flex justify-center gap-6 mt-12">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-full transition duration-200 shadow-lg hover:shadow-green-500/50"
          >
            <Shield className="w-5 h-5" />
            Accès Admin
          </Link>
          <Link
            href="/login" // Not created yet, but good placeholder
            className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-8 rounded-full transition duration-200 border border-gray-600"
          >
            Connexion
          </Link>
        </div>
      </div>
    </div>
  );
}
