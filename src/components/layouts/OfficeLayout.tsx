import Sidebar from "@/components/shared/Sidebar";
import Header from "@/components/shared/Header";
import { LayoutDashboard, FileCheck, User } from "lucide-react";
import { Outlet } from "react-router-dom";
import { NavItem } from "@/lib/types";
import { useState } from "react";

const navItems: NavItem[] = [
    {
        title: "Dashboard",
        href: "/office/dashboard",
        icon: <LayoutDashboard className="h-4 w-4" />,
    },
    {
        title: "Certificates Ready",
        href: "/office/certificates-ready",
        icon: <FileCheck className="h-4 w-4" />,
    },
    {
        title: "Profile",
        href: "/office/profile",
        icon: <User className="h-4 w-4" />,
    },
];

const OfficeLayout = () => {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const toggleCollapse = () => {
        setIsCollapsed(!isCollapsed);
    };
    return (
        <div className="flex flex-col h-screen w-full">
            <div className="flex flex-1">
                <Sidebar navItems={navItems} portalName="Office Portal" variant="default" isCollapsed={isCollapsed} toggleCollapse={toggleCollapse} />
                <div className="flex flex-col flex-1">
                    <Header navItems={navItems} portalName="Office Portal" />
                    <main className="flex-1 p-6 admin-layout-theme wavy-background">
                        <Outlet />
                    </main>
                </div>
            </div>
        </div>
    );
};
export default OfficeLayout;
