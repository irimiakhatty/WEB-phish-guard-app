"use client";

import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity, Users, Building2, CreditCard, BarChart3 } from "lucide-react";
import {
  AdminActivityPanel,
  AdminOrganizationsPanel,
  AdminScansPanel,
  AdminSubscriptionsPanel,
  AdminUsersPanel,
} from "@/features/admin/components";
import type { AdminScan } from "./types";
import { normalizeAdminTab } from "./types";

type AdminManagementTabsProps = {
  initialScans: AdminScan[];
  initialTab?: string;
};

export default function AdminManagementTabs({ initialScans, initialTab }: AdminManagementTabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeTab = normalizeAdminTab(searchParams.get("tab") ?? initialTab);

  const handleTabChange = (nextValue: string) => {
    const nextTab = normalizeAdminTab(nextValue);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", nextTab);

    const nextUrl = `${pathname}?${params.toString()}`;
    router.replace(nextUrl as Route, { scroll: false });
  };

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
      <TabsList className="grid w-full grid-cols-2 rounded-xl bg-muted/40 p-1 md:grid-cols-5">
        <TabsTrigger value="users">
          <Users className="mr-2 h-4 w-4" />
          Users
        </TabsTrigger>
        <TabsTrigger value="organizations">
          <Building2 className="mr-2 h-4 w-4" />
          Organizations
        </TabsTrigger>
        <TabsTrigger value="subscriptions">
          <CreditCard className="mr-2 h-4 w-4" />
          Subscriptions
        </TabsTrigger>
        <TabsTrigger value="scans">
          <BarChart3 className="mr-2 h-4 w-4" />
          Scans
        </TabsTrigger>
        <TabsTrigger value="activity">
          <Activity className="mr-2 h-4 w-4" />
          Activity
        </TabsTrigger>
      </TabsList>

      <TabsContent value="users">
        <AdminUsersPanel />
      </TabsContent>

      <TabsContent value="organizations">
        <AdminOrganizationsPanel />
      </TabsContent>

      <TabsContent value="subscriptions">
        <AdminSubscriptionsPanel />
      </TabsContent>

      <TabsContent value="scans">
        <AdminScansPanel initialScans={initialScans} />
      </TabsContent>

      <TabsContent value="activity">
        <AdminActivityPanel />
      </TabsContent>
    </Tabs>
  );
}
