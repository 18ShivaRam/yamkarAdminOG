"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Users, Shield, Clock, Key, Download } from "lucide-react"
import Link from "next/link"
import { useState, useEffect, useCallback } from "react"
import PasswordChangePopup from "@/components/PasswordChangePopup"
import { supabase } from "@/lib/supabaseClient"
import { useVisibilityRefetch } from "@/hooks/use-visibility-refetch"

export default function AdminDashboard() {
    const [showPasswordChangePopup, setShowPasswordChangePopup] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [stats, setStats] = useState([
    { label: "Total Managers", value: "-", isLoading: true },
    { label: "Total Employees", value: "-", isLoading: true },
    { label: "Pending Approvals", value: "-", isLoading: true },
    { label: "Active Users Today", value: "-", isLoading: true },
  ]);

  const fetchDashboardStats = useCallback(async () => {
    try {
      setIsFetching(true);
      // Use global overlay as the single loader
            // set local flags only for rendering fallback values, not for UI spinners
      setStats(prev => prev.map(s => ({ ...s, isLoading: true })));

      // Fetch total managers count
      const { count: managerCount, error: managerError } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'manager');

      if (managerError) throw managerError;

      // Fetch total employees count
      const { count: employeeCount, error: employeeError } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'employee');

      if (employeeError) throw employeeError;

      // Fetch pending approvals count
      const { count: pendingCount, error: pendingError } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      if (pendingError) throw pendingError;

      // Active Users Today (IST): count unique users who checked in during the IST day
      const IST_OFFSET_MIN = 330; // +05:30
      const nowUtcMs = Date.now();
      const nowIst = new Date(nowUtcMs + IST_OFFSET_MIN * 60_000);
      const y = nowIst.getUTCFullYear();
      const m = nowIst.getUTCMonth();
      const d = nowIst.getUTCDate();
      // IST day bounds converted to UTC by subtracting the IST offset
      const startOfIstUtc = new Date(Date.UTC(y, m, d, 0, 0, 0, 0) - IST_OFFSET_MIN * 60_000);
      const endOfIstUtc = new Date(Date.UTC(y, m, d, 23, 59, 59, 999) - IST_OFFSET_MIN * 60_000);

      const { data: todaysCheckins, error: todaysError } = await supabase
        .from('attendance_logs')
        .select('user_id, user:users!inner(role)')
        .gte('check_in', startOfIstUtc.toISOString())
        .lte('check_in', endOfIstUtc.toISOString());
      if (todaysError) throw todaysError;

      const filtered = (todaysCheckins || []).filter((r: any) => r.user?.role === 'manager' || r.user?.role === 'employee');
      const uniqueUserIds = new Set(filtered.map((r: any) => r.user_id));
      const activeCount = uniqueUserIds.size;

      setStats([
        { label: "Total Managers", value: managerCount?.toString() || "0", isLoading: false },
        { label: "Total Employees", value: employeeCount?.toString() || "0", isLoading: false },
        { label: "Pending Approvals", value: pendingCount?.toString() || "0", isLoading: false },
        { label: "Active Users Today", value: activeCount?.toString() || "0", isLoading: false },
      ]);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      // Set error state or handle accordingly
      setStats(prev => prev.map(stat => ({ ...stat, isLoading: false })));
    } finally {
      setIsFetching(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardStats();
  }, [fetchDashboardStats]);

  // Refetch when tab becomes visible/focused or when page is restored from bfcache
  useVisibilityRefetch(() => {
    fetchDashboardStats();
  }, 150);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#228B22]">Admin Dashboard</h1>
        <p className="text-[#6B8E23]">System Administration</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <Card key={index}>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">{stat.label}</div>
              <div className="text-2xl font-bold text-[#228B22]">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="h-12 w-12 rounded-full bg-[#228B22] bg-opacity-10 flex items-center justify-center">
                <Users className="h-6 w-6 text-[#228B22]" />
              </div>
              <Button variant="ghost" className="text-[#6B8E23]" asChild>
                <Link href="/admin/managers">View Managers</Link>
              </Button>
            </div>
            <h2 className="text-lg font-semibold mb-2">Manager Management</h2>
            <p className="text-sm text-muted-foreground">View and manage manager accounts</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="h-12 w-12 rounded-full bg-[#228B22] bg-opacity-10 flex items-center justify-center">
                <Users className="h-6 w-6 text-[#228B22]" />
              </div>
              <Button variant="ghost" className="text-[#6B8E23]" asChild>
                <Link href="/admin/employees">View Employees</Link>
              </Button>
            </div>
            <h2 className="text-lg font-semibold mb-2">Employee Management</h2>
            <p className="text-sm text-muted-foreground">View and manage all employee accounts</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="h-12 w-12 rounded-full bg-[#228B22] bg-opacity-10 flex items-center justify-center">
                <Clock className="h-6 w-6 text-[#228B22]" />
              </div>
              <Button variant="ghost" className="text-[#6B8E23]" asChild>
                <Link href="/admin/approvals">View Approvals</Link>
              </Button>
            </div>
            <h2 className="text-lg font-semibold mb-2">Pending Approvals</h2>
            <p className="text-sm text-muted-foreground">Review and approve new account requests</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="h-12 w-12 rounded-full bg-[#228B22] bg-opacity-10 flex items-center justify-center">
                <Download className="h-6 w-6 text-[#228B22]" />
              </div>
              <Button variant="ghost" className="text-[#6B8E23]" asChild>
                <Link href="/admin/reports">View Reports</Link>
              </Button>
            </div>
            <h2 className="text-lg font-semibold mb-2">Reports</h2>
            <p className="text-sm text-muted-foreground">View and export attendance and farmer data reports</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="h-12 w-12 rounded-full bg-[#228B22] bg-opacity-10 flex items-center justify-center">
                <Key className="h-6 w-6 text-[#228B22]" />
              </div>
              <Button 
                variant="ghost" 
                className="text-[#6B8E23]"
                onClick={() => setShowPasswordChangePopup(true)}
              >
                Change Password
              </Button>
            </div>
            <h2 className="text-lg font-semibold mb-2">Password</h2>
            <p className="text-sm text-muted-foreground">Update your account password</p>
          </CardContent>
        </Card>
      </div>

      {/* Password Change Popup */}
      <PasswordChangePopup
        isOpen={showPasswordChangePopup}
        onClose={() => setShowPasswordChangePopup(false)}
      />
    </div>
  )
}

