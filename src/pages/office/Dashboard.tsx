import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileCheck, FileClock } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchRequests } from "@/data/appData";
import { BonafideRequest } from "@/lib/types";
import { useSession } from "@/components/auth/SessionContextProvider";
import { showError } from "@/utils/toast";

const OfficeDashboard = () => {
    const { user } = useSession();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        readyToIssue: 0,
        issued: 0,
    });

    useEffect(() => {
        const loadStats = async () => {
            try {
                const allRequests = await fetchRequests();
                const readyToIssue = allRequests.filter(r => r.status === "Approved by Principal").length;
                const issued = allRequests.filter(r => r.status === "Issued").length;

                setStats({
                    readyToIssue,
                    issued,
                });
            } catch (error: any) {
                showError("Failed to load dashboard statistics.");
            } finally {
                setLoading(false);
            }
        };

        if (user) {
            loadStats();
        }
    }, [user]);

    if (loading) {
        return <div className="p-8 text-center">Loading dashboard...</div>;
    }

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold tracking-tight">Office Dashboard</h1>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Ready to Issue</CardTitle>
                        <FileClock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.readyToIssue}</div>
                        <p className="text-xs text-muted-foreground">Requests approved by Principal</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Issued</CardTitle>
                        <FileCheck className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.issued}</div>
                        <p className="text-xs text-muted-foreground">Certificates handed over</p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default OfficeDashboard;
