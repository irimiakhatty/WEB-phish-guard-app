"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { authClient } from "@/lib/auth-client";

export default function AdminRiskReport() {
  const { data: session, isPending } = authClient.useSession();
  const userRole = (session?.user as { role?: string } | undefined)?.role;
  const isSuperAdmin = userRole === "super_admin";
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isPending) return;
    if (!session?.user || !isSuperAdmin) {
      setLoading(false);
      return;
    }

    async function fetchReport() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/v1/admin/reports");
        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            setLoading(false);
            return;
          }
          throw new Error("Failed to load report");
        }
        const data = await res.json();
        if (!data.success) throw new Error(data.error || "Unknown error");
        setReport(data.data);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    fetchReport();
  }, [isPending, session?.user?.id, isSuperAdmin]);

  if (!session?.user || !isSuperAdmin) return null;
  if (loading) return <div>Loading risk report...</div>;
  if (error) return <div className="text-red-600">Error: {error}</div>;
  if (!report) return null;

  return (
    <div className="mt-12">
      <h2 className="text-2xl font-bold mb-6">Security Risk Report</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Top 5 Risk Departments</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal ml-6">
              {report.departments.map((d: any, i: number) => (
                <li key={d.departmentId}>
                  Dept: <b>{d.departmentId}</b> — <span className="text-red-600 font-semibold">{d._count.id} risky actions</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Top 5 Risk Employees</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal ml-6">
              {report.users.map((u: any, i: number) => (
                <li key={u.userId}>
                  User: <b>{u.userId}</b> — <span className="text-red-600 font-semibold">{u._count.id} risky actions</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Incident Evolution (last 30 days)</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="ml-6">
            {report.incidents.map((inc: any, i: number) => (
              <li key={i}>
                {new Date(inc.detectedAt).toLocaleDateString()} — <b>{inc._count.id}</b> incidents
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
