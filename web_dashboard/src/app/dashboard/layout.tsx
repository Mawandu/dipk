import { Sidebar } from "./_components/Sidebar";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex h-screen overflow-hidden bg-gray-100">
            <Sidebar />
            <div className="flex flex-1 flex-col overflow-y-auto">
                <main className="flex-1 p-6">
                    {children}
                </main>
            </div>
        </div>
    );
}
