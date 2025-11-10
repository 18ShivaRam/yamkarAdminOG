"use client"

import { useState, useEffect, useMemo } from "react";
import dynamic from 'next/dynamic';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, MapPin, CheckCircle, XCircle, Clock, ChevronDown, ChevronRight, ChevronLeft, History, Calendar } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/contexts/auth-context";
import { supabase, fetchLatestEmployeeLocation, fetchEmployeeLocationsForDate, fetchAttendanceLogForDate } from "@/lib/supabaseClient";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import EmployeeDetailsPopup from "@/components/EmployeeDetailsPopup";
import { format } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";

// Dynamically load components that use browser APIs
const MapboxMap = dynamic(() => import('@/components/MapboxMap'), { ssr: false });
const EmployeeDataPopup = dynamic(() => import('@/components/EmployeeDataPopup'), { ssr: false });

interface Employee {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  role: string;
  location?: string;
  avatar?: string;
  status: 'checked-in' | 'checked-out';
  lastCheckTime: string | null;
  cadre?: { name: string };
  manager?: { name: string };
  currentLogId?: string | null;
  locationUpdatedAt?: string | null;
  lastLogId?: string | null;
  aadhar_number?: string;
  pan_number?: string;
  driving_license?: string;
  address?: string;
  state?: string;
  district?: string;
  mandal?: string;
  village?: string;
  hasLocationData?: boolean;
}

// Create a client-only wrapper
const AdminEmployeeList = () => {
  const [searchQuery, setSearchQuery] = useState("")
  const { user } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([])
  const [expandedEmployeeId, setExpandedEmployeeId] = useState<string | null>(null);
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 50
  const [statusFilter, setStatusFilter] = useState<'all'|'active'|'inactive'>('all')
  const [todayCheckedInIds, setTodayCheckedInIds] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false);
  const [employeeDates, setEmployeeDates] = useState<{[key: string]: Date}>({});
  const [noLocationData, setNoLocationData] = useState<{[key: string]: boolean}>({});
  const [employeeLocations, setEmployeeLocations] = useState<{[key: string]: any[]}>({});

  useEffect(() => {
    const refreshAll = async () => {
      await Promise.all([fetchEmployees(), fetchTodayCheckedIn()])
    }
    refreshAll();
    // Add visibility change listener to refresh data when tab becomes active
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshAll();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user]);

  useEffect(() => {
    setPage(0)
  }, [searchQuery, statusFilter])

  const fetchEmployees = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      // Optimized single query with available joins
      const { data, error } = await supabase
        .from('users')
        .select(`
          *,
          manager:manager_id(name),
          cadre(name),
          attendance_logs(id, check_in, check_out),
          states!users_state_fkey(state_name),
          districts!users_district_fkey(district_name),
          mandals!users_mandal_fkey(mandal_name)
        `)
        .eq("role", "employee")
        .eq("status", "approved");

      if (error) {
        console.error("Error fetching employees:", error);
        return;
      }

      interface AttendanceLog {
        id: string;
        check_in: string;
        check_out: string | null;
      }

      // Process employees without making additional queries
      const employeesWithStatus = data.map(employee => {
        const latestLog = employee.attendance_logs?.sort((a: AttendanceLog, b: AttendanceLog) => 
          new Date(b.check_in).getTime() - new Date(a.check_in).getTime()
        )[0];
        
        const lastAttendanceLogId = latestLog?.id || null;
        
        return {
          ...employee,
          status: latestLog ? (latestLog.check_out ? "checked-out" : "checked-in") : "checked-out",
          lastCheckTime: latestLog?.check_in ? new Date(latestLog.check_in).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit"
          }) : null,
          currentLogId: latestLog && !latestLog.check_out ? latestLog.id : null,
          lastLogId: lastAttendanceLogId,
          location: "", // Will be loaded on demand
          locationUpdatedAt: null, // Will be loaded on demand
          // Ensure all required fields are available for EmployeeDetailsPopup
          email: employee.email || "",
          phone: employee.phone || "",
          manager: { name: employee.manager?.name || "" },
          aadhar_number: employee.aadhar_number || "",
          pan_number: employee.pan_number || "",
          driving_license: employee.driving_license || "",
          address: employee.address || "",
          // Use the resolved location names from joins and direct fields
          state: employee.states?.state_name || "Unknown",
          district: employee.districts?.district_name || "Unknown", 
          mandal: employee.mandals?.mandal_name || "Unknown",
          village: employee.village || "Unknown" // Direct text field, not a foreign key
        };
      });

      setEmployees(employeesWithStatus);
    } catch (error) {
      console.error("Failed to fetch employees", error);
    } finally {
      setIsLoading(false);
    }
  }

  const fetchTodayCheckedIn = async () => {
    try {
      // IST bounds
      const IST_OFFSET_MIN = 330
      const nowUtcMs = Date.now()
      const nowIst = new Date(nowUtcMs + IST_OFFSET_MIN * 60_000)
      const y = nowIst.getUTCFullYear()
      const m = nowIst.getUTCMonth()
      const d = nowIst.getUTCDate()
      const startIstUtc = new Date(Date.UTC(y, m, d, 0, 0, 0, 0) - IST_OFFSET_MIN * 60_000)
      const endIstUtc = new Date(Date.UTC(y, m, d, 23, 59, 59, 999) - IST_OFFSET_MIN * 60_000)

      const { data, error } = await supabase
        .from('attendance_logs')
        .select('user_id')
        .gte('check_in', startIstUtc.toISOString())
        .lte('check_in', endIstUtc.toISOString())

      if (error) throw error
      const uniqueIds = Array.from(new Set((data || []).map((r: any) => r.user_id)))
      setTodayCheckedInIds(uniqueIds)
    } catch (e) {
      console.error('Failed to fetch today checkins', e)
      setTodayCheckedInIds([])
    }
  }

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .substring(0, 2)
  }

  // Function to fetch location data on demand
  const fetchEmployeeLocation = async (employeeId: string, overrideDate?: Date) => {
    try {
      // Clear previous no location data flag for this employee
      setNoLocationData(prev => ({ ...prev, [employeeId]: false }));
      
      // Use the override date if provided, otherwise use employee-specific or today
      const selectedDate = overrideDate || employeeDates[employeeId] || new Date();
      const dateString = format(selectedDate, 'yyyy-MM-dd');
      
      // First try to fetch employee locations
      const allLocations = await fetchEmployeeLocationsForDate(employeeId, dateString);
      
      if (allLocations && allLocations.length > 0) {
        // Store all locations for the map
        setEmployeeLocations(prev => ({
          ...prev,
          [employeeId]: allLocations
        }));
        
        // Use the latest location for display
        const latestLocation = allLocations[allLocations.length - 1];
        const locationStr = `${latestLocation.latitude},${latestLocation.longitude}`;
        const locationUpdatedAt = new Date(latestLocation.captured_at).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit"
        });
        
        // Update only this specific employee's location data
        setEmployees(prevEmployees => 
          prevEmployees.map(emp => 
            emp.id === employeeId 
              ? { ...emp, location: locationStr, locationUpdatedAt, hasLocationData: true }
              : emp
          )
        );
      } else {
        // If no location data found, try fetching attendance log as fallback
        console.log(`No location data found for employee ${employeeId} on ${dateString}, trying attendance log...`);
        const attendanceLog = await fetchAttendanceLogForDate(employeeId, dateString);
        
        if (attendanceLog) {
          // Attendance log found, but it doesn't contain location data
          // We'll show a message indicating attendance was recorded but no location is available
          console.log(`Attendance log found for employee ${employeeId} but no location data available`);
          setNoLocationData(prev => ({ ...prev, [employeeId]: true }));
          setEmployeeLocations(prev => ({
            ...prev,
            [employeeId]: []
          }));
          setEmployees(prevEmployees => 
            prevEmployees.map(emp => 
              emp.id === employeeId 
                ? { ...emp, location: "Attendance recorded - No location data", locationUpdatedAt: new Date(attendanceLog.created_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit"
                  }), hasLocationData: false }
                : emp
            )
          );
        } else {
          // No data found at all
          setNoLocationData(prev => ({ ...prev, [employeeId]: true }));
          setEmployeeLocations(prev => ({
            ...prev,
            [employeeId]: []
          }));
          setEmployees(prevEmployees => 
            prevEmployees.map(emp => 
              emp.id === employeeId 
                ? { ...emp, location: "", locationUpdatedAt: null, hasLocationData: false }
                : emp
            )
          );
        }
      }
    } catch (e) {
      console.error(`Error fetching location for employee ${employeeId}:`, e);
      setNoLocationData(prev => ({ ...prev, [employeeId]: true }));
    }
  };

  const handleExpandClick = (employeeId: string) => {
    const isExpanding = expandedEmployeeId !== employeeId;
    
    // If we're closing the dropdown, reset the date for this employee
    if (!isExpanding && expandedEmployeeId === employeeId) {
      setEmployeeDates(prev => {
        const newDates = {...prev};
        delete newDates[employeeId];
        return newDates;
      });
    }
    
    setExpandedEmployeeId(isExpanding ? employeeId : null);
    
    // Fetch location data when expanding
    if (isExpanding) {
      fetchEmployeeLocation(employeeId);
    }
  };
  
  // Function to handle date change for a specific employee
  const handleDateChange = (employeeId: string, date: Date | undefined) => {
    if (date) {
      setEmployeeDates(prev => ({
        ...prev,
        [employeeId]: date
      }));
      
      // Refresh the employee's location data using the date directly to avoid stale state
      fetchEmployeeLocation(employeeId, date);
    }
  };

  // Filter employees based on search query
  const searchedEmployees = employees.filter(employee => {
    const matchesSearch = employee.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (employee.cadre?.name && employee.cadre.name.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSearch;
  });
  const todaySet = useMemo(() => new Set(todayCheckedInIds), [todayCheckedInIds])
  const filteredEmployees = statusFilter === 'all'
    ? searchedEmployees
    : searchedEmployees.filter(e => statusFilter === 'active' ? todaySet.has(e.id) : !todaySet.has(e.id))

  const total = filteredEmployees.length
  const start = total === 0 ? 0 : page * PAGE_SIZE + 1
  const end = Math.min(total, (page + 1) * PAGE_SIZE)
  const pagedEmployees = filteredEmployees.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#228B22]">Employee Management</h1>
          <p className="text-sm text-[#6B8E23]">Showing approved employees only</p>
        </div>
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchEmployees} disabled={isLoading}
            className="flex items-center gap-1"
          >
            <>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-refresh-cw"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/></svg>
              <span>{isLoading ? 'Refreshing...' : 'Refresh'}</span>
            </>
          </Button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#6B8E23]" />
          <Input
            placeholder="Search employees by name or cadre..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={(v: 'all'|'active'|'inactive') => setStatusFilter(v)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <span className="text-sm text-muted-foreground">{total === 0 ? '0 of 0' : `${start}-${end} of ${total}`}</span>
          <Button variant="outline" size="icon" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => setPage(p => p + 1)} disabled={end >= total}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {pagedEmployees.length > 0 ? (
          pagedEmployees.map((employee) => (
            <Card key={employee.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <Avatar className="h-10 w-10 border border-[#F4A460]">
                    <AvatarImage src={employee.avatar || ""} alt={employee.name} />
                    <AvatarFallback className="bg-[#F4A460] text-white">
                      {getInitials(employee.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="font-medium">{employee.name}</div>
                    <div className="text-sm text-[#6B8E23]">
                      {employee.cadre?.name || "Staff"}
                    </div>
                  </div>

                  <div className="hidden md:flex items-center gap-4">
                    <button
                      onClick={() => handleExpandClick(employee.id)}
                      className="p-0"
                    >
                      <ChevronDown
                        className={`h-4 w-4 transition-transform text-[#6B8E23] ${
                          expandedEmployeeId === employee.id ? "rotate-180 text-[#D3D3D3]" : ""
                        }`}
                      />
                    </button>

                    <EmployeeDetailsPopup employee={employee} />
                  </div>
                </div>

                <div className="md:hidden mt-2 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleExpandClick(employee.id)}
                      className="p-0"
                    >
                      <ChevronDown
                        className={`h-3 w-3 transition-transform text-[#6B8E23] ${
                          expandedEmployeeId === employee.id ? "rotate-180 text-[#D3D3D3]" : ""
                        }`}
                      />
                    </button>
                    <EmployeeDetailsPopup employee={employee} />
                  </div>
                </div>
                {expandedEmployeeId === employee.id && (
                  <div className="mt-4">
                    <div className="relative">
                      <div 
                        className="w-full bg-gray-100 rounded-lg overflow-hidden" 
                        style={{ height: "350px" }}
                        data-map-container={employee.id}
                      >
                        {employee.hasLocationData ? (
                          employeeLocations[employee.id] && employeeLocations[employee.id].length > 0 ? (
                            // Show all locations for the selected date as a path
                            <MapboxMap
                              employeeId={employee.id}
                              showPath={true}
                              locations={employeeLocations[employee.id]}
                              containerType="movement-path"
                              height="400px"
                            />
                          ) : (employee.currentLogId || employee.lastLogId) ? (
                            // If we have a log ID, show the movement path which includes current location
                            <MapboxMap
                              employeeId={employee.id}
                              showPath={true}
                              attendanceLogId={employee.currentLogId || undefined}
                              containerType="movement-path"
                              height="400px"
                            />
                          ) : (
                            // Otherwise fall back to just current location
                            <MapboxMap
                              employeeId={employee.id}
                              location={employee.location}
                              containerType="current-location"
                              height="300px"
                            />
                          )
                        ) : (
                          <div className="h-full flex items-center justify-center">
                             <div className="text-center p-4">
                                 <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                               <p className="text-gray-500 font-medium">No location data available for {employeeDates[employee.id] ? format(employeeDates[employee.id], "PPP") : "today"}.</p>
                               <p className="text-gray-400 text-sm mt-1">Try selecting a different date or check if the employee was active on this day.</p>
                             </div>
                           </div>
                        )}
                      </div>
                      <div className="mt-2 bg-[#F4FAF4] p-3 rounded-lg">
                        <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2 ml-auto">
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 px-2 text-xs"
                                data-employee-id={employee.id}
                              >
                                <Calendar className="h-3 w-3 mr-1" />
                                {employeeDates[employee.id] 
                                  ? format(employeeDates[employee.id], "PPP") 
                                  : "Today"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="end">
                              <CalendarComponent
                                mode="single"
                                selected={employeeDates[employee.id] || new Date()}
                                onSelect={(date) => {
                                  handleDateChange(employee.id, date);
                                  // Close the popover after date selection
                                  const popoverTrigger = document.querySelector(`[data-employee-id="${employee.id}"]`) as HTMLElement;
                                  if (popoverTrigger) {
                                    popoverTrigger.click();
                                  }
                                }}
                                initialFocus
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-[#6B8E23]">No employees found matching your search criteria.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// Create a wrapper component that only renders on the client
const AdminEmployeeListPage = () => {
  return <AdminEmployeeList />;
};

export default dynamic(() => Promise.resolve(AdminEmployeeListPage), { ssr: false });
