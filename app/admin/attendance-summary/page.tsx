"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { supabase } from "@/lib/supabaseClient";
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";

interface UserInfo {
  id: string;
  name: string;
  email: string;
  role: string;
  manager_id?: string | null;
}

interface DailyAttendance {
  date: string;
  dayOfMonth: number;
  checkIn: string | null;
  checkOut: string | null;
}

interface UserAttendance {
  user: UserInfo;
  dailyAttendance: DailyAttendance[];
}

export default function AttendanceSummaryPage() {
  const { user } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [userType, setUserType] = useState<"employee" | "manager">("employee");
  const [managersList, setManagersList] = useState<UserInfo[]>([]);
  const [selectedManagerId, setSelectedManagerId] = useState<string>("all");
  const [employeesList, setEmployeesList] = useState<UserInfo[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("all");
  const [allEmployeesList, setAllEmployeesList] = useState<UserInfo[]>([]);
  const [attendanceData, setAttendanceData] = useState<UserAttendance[]>([]);
  const [daysInMonth, setDaysInMonth] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [employeeDropdownTouched, setEmployeeDropdownTouched] = useState(false);

  // Fetch managers or employees based on userType
  useEffect(() => {
    if (userType === "manager") {
      fetchActiveManagers();
      setSelectedEmployeeId("all");
      setEmployeesList([]);
    } else if (userType === "employee") {
      fetchAllActiveEmployees();
      setSelectedManagerId("all");
      setManagersList([]);
    }
  }, [userType]);

  // Fetch employees when a specific manager is selected
  useEffect(() => {
    if (userType === "manager" && selectedManagerId !== "all") {
      setEmployeeDropdownTouched(false);
      fetchEmployeesForManager(selectedManagerId);
    } else if (userType === "manager") {
      setEmployeesList([]);
      setSelectedEmployeeId("all");
    }
  }, [selectedManagerId, userType]);

  // Fetch attendance data when filters change
  useEffect(() => {
    fetchAttendanceSummary();
  }, [selectedMonth, userType, selectedManagerId, selectedEmployeeId]);

  const fetchActiveManagers = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("users")
      .select("id, name, email, role, manager_id")
      .eq("role", "manager")
      .eq("status", "approved")
      .eq("is_deleted", false)
      .order("name");

    if (error) {
      console.error("Error fetching managers:", error);
      setManagersList([]);
    } else {
      setManagersList(data || []);
    }
    setIsLoading(false);
  };

  const fetchAllActiveEmployees = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("users")
      .select("id, name, email, role, manager_id")
      .eq("role", "employee")
      .eq("status", "approved")
      .eq("is_deleted", false)
      .order("name");

    if (error) {
      console.error("Error fetching employees:", error);
      setAllEmployeesList([]);
    } else {
      setAllEmployeesList(data || []);
    }
    setIsLoading(false);
  };

  const fetchEmployeesForManager = async (managerId: string) => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("users")
      .select("id, name, email, role, manager_id")
      .eq("role", "employee")
      .eq("manager_id", managerId)
      .eq("status", "approved")
      .eq("is_deleted", false)
      .order("name");

    if (error) {
      console.error("Error fetching employees for manager:", error);
      setEmployeesList([]);
    } else {
      setEmployeesList(data || []);
    }
    setIsLoading(false);
  };

  const fetchAttendanceSummary = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        month: selectedMonth,
        userType,
        ...(selectedManagerId && { selectedManagerId }),
        ...(selectedEmployeeId && { selectedEmployeeId })
      });

      const response = await fetch(`/api/attendance/summary-report?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch summary");
      
      const data = await response.json();
      setAttendanceData(data.users || []);
      setDaysInMonth(data.daysInMonth || []);
    } catch (error) {
      console.error("Error fetching attendance summary:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrevMonth = () => {
    const [year, month] = selectedMonth.split("-").map(Number);
    const newDate = subMonths(new Date(year, month - 1, 1), 1);
    setSelectedMonth(`${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, "0")}`);
  };

  const handleNextMonth = () => {
    const [year, month] = selectedMonth.split("-").map(Number);
    const newDate = addMonths(new Date(year, month - 1, 1), 1);
    setSelectedMonth(`${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, "0")}`);
  };

  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return "";
    return format(new Date(timeStr), "hh:mm a");
  };

  const exportToCSV = () => {
    if (attendanceData.length === 0 || daysInMonth.length === 0) return;

    // Create CSV headers
    const headers = ["Employee Name", "Role", ...daysInMonth.map(date => {
      const d = new Date(date);
      return `${format(d, "dd-MMM")} (In)`;
    }), ...daysInMonth.map(date => {
      const d = new Date(date);
      return `${format(d, "dd-MMM")} (Out)`;
    })];

    // Create CSV rows
    const rows = attendanceData.map(item => {
      const row: string[] = [item.user.name, item.user.role];
      
      // Add check-in times
      item.dailyAttendance.forEach(day => {
        row.push(formatTime(day.checkIn));
      });
      
      // Add check-out times
      item.dailyAttendance.forEach(day => {
        row.push(formatTime(day.checkOut));
      });
      
      return row;
    });

    // Combine headers and rows
    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n");

    // Create and download the CSV
    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `attendance-summary-${selectedMonth}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const monthDisplay = (() => {
    const [year, month] = selectedMonth.split("-").map(Number);
    return format(new Date(year, month - 1, 1), "MMMM yyyy");
  })();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#228B22]">Attendance Summary Report</h1>
        <p className="text-[#6B8E23]">View monthly attendance summary for employees and managers</p>
      </div>

      <Card>
        <CardContent className="p-6 space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-4">
            {/* Month Selector */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={handlePrevMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="min-w-[150px] text-center font-medium">
                {monthDisplay}
              </div>
              <Button variant="outline" size="icon" onClick={handleNextMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* User Type Selector */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">User Type:</span>
              <Select
                value={userType}
                onValueChange={(value: "employee" | "manager") => setUserType(value)}
              >
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Select user type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Manager Selector */}
            {userType === "manager" && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Manager:</span>
                <Select
                  value={selectedManagerId}
                  onValueChange={setSelectedManagerId}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select manager" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Managers</SelectItem>
                    {managersList.map(manager => (
                      <SelectItem key={manager.id} value={manager.id}>
                        {manager.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Employee Selector (for manager user type) */}
            {userType === "manager" && selectedManagerId !== "all" && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Employee:</span>
                <Select
                  value={employeeDropdownTouched ? selectedEmployeeId : ""}
                  onValueChange={(value) => {
                    setEmployeeDropdownTouched(true);
                    setSelectedEmployeeId(value);
                  }}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Employees</SelectItem>
                    {employeesList.map(emp => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Employee Selector (for employee user type) */}
            {userType === "employee" && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Employee:</span>
                <Select
                  value={selectedEmployeeId}
                  onValueChange={setSelectedEmployeeId}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Employees</SelectItem>
                    {allEmployeesList.map(emp => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex-grow"></div>

            {/* Export Button */}
            <Button
              onClick={exportToCSV}
              disabled={isLoading || attendanceData.length === 0}
              className="bg-[#228B22] hover:bg-[#1A6B1A]"
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Attendance Table */}
      <Card>
        <CardContent className="p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-[#228B22]" />
              <span className="ml-2">Loading attendance summary...</span>
            </div>
          ) : attendanceData.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No attendance data found for the selected criteria.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap sticky left-0 bg-background z-10">
                      Employee
                    </TableHead>
                    <TableHead className="whitespace-nowrap">Role</TableHead>
                    {daysInMonth.map((date, index) => {
                      const d = new Date(date);
                      return (
                        <TableHead key={date} className="whitespace-nowrap text-center min-w-[120px]">
                          <div>{format(d, "dd-MMM")}</div>
                          <div className="text-xs text-muted-foreground">
                            {format(d, "EEE")}
                          </div>
                        </TableHead>
                      );
                    })}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendanceData.map((item) => (
                    <TableRow key={item.user.id}>
                      <TableCell className="sticky left-0 bg-background z-10 font-medium">
                        {item.user.name}
                      </TableCell>
                      <TableCell className="capitalize">{item.user.role}</TableCell>
                      {item.dailyAttendance.map((day) => (
                        <TableCell key={day.date} className="text-center">
                          <div className="space-y-1">
                            {day.checkIn ? (
                              <div className="text-sm text-green-700">
                                {formatTime(day.checkIn)}
                              </div>
                            ) : (
                              <div className="text-sm text-gray-400">-</div>
                            )}
                            {day.checkOut ? (
                              <div className="text-sm text-blue-700">
                                {formatTime(day.checkOut)}
                              </div>
                            ) : day.checkIn ? (
                              <div className="text-sm text-orange-600">
                                Not Checked Out
                              </div>
                            ) : (
                              <div className="text-sm text-gray-400">-</div>
                            )}
                          </div>
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
