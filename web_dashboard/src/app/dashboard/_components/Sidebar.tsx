"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Map, Users, Truck, FileText, Settings, LogOut, Trash2 } from "lucide-react";

export function Sidebar() {
    const pathname = usePathname();

    const links = [
        { name: "Vue d'ensemble", href: "/dashboard", icon: LayoutDashboard },
        { name: "Carte Globale", href: "/dashboard/map", icon: Map },
        { name: "Signalements", href: "/dashboard/reports", icon: FileText },
        { name: "Utilisateurs", href: "/dashboard/users", icon: Users }, // Admin only
        { name: "Centres de Transit", href: "/dashboard/transit", icon: Truck },
        { name: "Enfouissement", href: "/dashboard/landfill", icon: Trash2 },
    ];

    return (
        <div className="flex h-full w-64 flex-col bg-gray-900 text-white">
            <div className="flex h-16 items-center justify-center border-b border-gray-800">
                <h1 className="text-xl font-bold text-green-400">DIPK Admin</h1>
            </div>
            <nav className="flex-1 space-y-1 px-2 py-4">
                {links.map((link) => {
                    const Icon = link.icon;
                    const isActive = pathname === link.href;
                    return (
                        <Link
                            key={link.name}
                            href={link.href}
                            className={cn(
                                "group flex items-center rounded-md px-2 py-2 text-sm font-medium",
                                isActive
                                    ? "bg-gray-800 text-white"
                                    : "text-gray-300 hover:bg-gray-800 hover:text-white"
                            )}
                        >
                            <Icon className="mr-3 h-5 w-5 flex-shrink-0" />
                            {link.name}
                        </Link>
                    );
                })}
            </nav>
            <div className="border-t border-gray-800 p-4">
                <button
                    onClick={() => {
                        localStorage.removeItem("token");
                        localStorage.removeItem("username");
                        window.location.href = "/login";
                    }}
                    className="flex w-full items-center px-2 py-2 text-sm font-medium text-red-400 hover:text-red-300"
                >
                    <LogOut className="mr-3 h-5 w-5" />
                    Déconnexion
                </button>
            </div>
        </div>
    );
}
