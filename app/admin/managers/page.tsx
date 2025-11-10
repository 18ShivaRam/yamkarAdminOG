"use client";

import type React from "react";
import { supabase, fetchLatestEmployeeLocation, fetchEmployeeLocationsForDate, fetchAttendanceLogForDate } from "@/lib/supabaseClient";
import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Search, Mail, CheckCircle, XCircle, Clock, ChevronDown, ChevronRight, ChevronLeft, History, MapPin, Calendar as CalendarIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import dynamic from 'next/dynamic';
import ManagerDetailsPopup from "@/components/ManagerDetailsPopup";

// Dynamically load components that use browser APIs
const MapboxMap = dynamic(() => import('@/components/MapboxMap'), { ssr: false });

export default function ManagerManagementPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [managers, setManagers] = useState<any[]>([]);
  const [expandedManagerId, setExpandedManagerId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;
  const [statusFilter, setStatusFilter] = useState<'all'|'active'|'inactive'>('all');
  const [todayCheckedInIds, setTodayCheckedInIds] = useState<string[]>([]);
  const [managerDates, setManagerDates] = useState<Record<string, Date>>({});
  const [noLocationData, setNoLocationData] = useState<Record<string, boolean>>({});
  const [managerLocations, setManagerLocations] = useState<{[key: string]: any[]}>({});
  
  useEffect(() => {
    const refreshAll = async () => {
      await Promise.all([fetchManagers(), fetchTodayCheckedIn()])
    }
    refreshAll();
    const onVisible = () => { if (document.visibilityState === 'visible') refreshAll() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, []);

  useEffect(() => { setPage(0) }, [searchQuery, statusFilter])

  const fetchManagers = async () => {
    try {
      setIsLoading(true);
      
      // Optimized single query with all necessary joins
      const { data: managerData, error: managerError } = await supabase
        .from('users')
        .select(`
          *,
          attendance_logs(id, check_in, check_out),
          states!users_state_fkey(state_name),
          districts!users_district_fkey(district_name),
          mandals!users_mandal_fkey(mandal_name)
        `)
        .eq('role', 'manager')
        .eq('status', 'approved');

      if (managerError) {
        console.error("Error fetching managers:", managerError);
        return;
      }

      interface AttendanceLog {
        id: string;
        check_in: string;
        check_out: string | null;
      }

      // Process managers without making additional queries
      const managersWithDetails = managerData.map(manager => {
        const latestLog = manager.attendance_logs?.sort((a: AttendanceLog, b: AttendanceLog) => 
          new Date(b.check_in).getTime() - new Date(a.check_in).getTime()
        )[0];
        
        const lastAttendanceLogId = latestLog?.id || null;
        
        return {
          ...manager,
          employeeCount: 0, // Will be loaded on demand if needed
          status: latestLog ? (latestLog.check_out ? "checked-out" : "checked-in") : "checked-out",
          lastCheckTime: latestLog?.check_in ? new Date(latestLog.check_in).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit"
          }) : null,
          currentLogId: latestLog && !latestLog.check_out ? latestLog.id : null,
          lastLogId: lastAttendanceLogId,
          location: "", // Will be loaded on demand
          locationUpdatedAt: null, // Will be loaded on demand
          // Use the resolved location names from joins and direct fields
          state: manager.states?.state_name || "Unknown",
          district: manager.districts?.district_name || "Unknown", 
          mandal: manager.mandals?.mandal_name || "Unknown",
          village: manager.village || "Unknown" // Direct text field, not a foreign key
        };
      });

      setManagers(managersWithDetails);
    } catch (error) {
      console.error("Failed to fetch managers", error);
    } finally {
      setIsLoading(false);
          }
  };

  // Fetch list of user IDs that checked in today (IST day)
  const fetchTodayCheckedIn = async () => {
    try {
      const IST_OFFSET_MIN = 330; // +05:30
      const nowUtcMs = Date.now();
      const nowIst = new Date(nowUtcMs + IST_OFFSET_MIN * 60_000);
      const y = nowIst.getUTCFullYear();
      const m = nowIst.getUTCMonth();
      const d = nowIst.getUTCDate();
      const startIstUtc = new Date(Date.UTC(y, m, d, 0, 0, 0, 0) - IST_OFFSET_MIN * 60_000);
      const endIstUtc = new Date(Date.UTC(y, m, d, 23, 59, 59, 999) - IST_OFFSET_MIN * 60_000);

      const { data, error } = await supabase
        .from('attendance_logs')
        .select('user_id')
        .gte('check_in', startIstUtc.toISOString())
        .lte('check_in', endIstUtc.toISOString());
      if (error) throw error;
      const uniqueIds = Array.from(new Set((data || []).map((r: any) => r.user_id)));
      setTodayCheckedInIds(uniqueIds);
    } catch (e) {
      console.error('Failed to fetch today checkins', e);
      setTodayCheckedInIds([]);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
  };

  // Function to fetch location data on demand for managers
  const fetchManagerLocation = async (managerId: string, overrideDate?: Date) => {
    try {
      setNoLocationData(prev => ({ ...prev, [managerId]: false }));
      const selectedDate = overrideDate || managerDates[managerId] || new Date();
      const dateString = format(selectedDate, 'yyyy-MM-dd');
      
      // First try to fetch employee locations
      const allLocations = await fetchEmployeeLocationsForDate(managerId, dateString);

      if (allLocations && allLocations.length > 0) {
        setManagerLocations(prev => ({ ...prev, [managerId]: allLocations }));
        const latestLocation = allLocations[allLocations.length - 1];
        const locationStr = `${latestLocation.latitude},${latestLocation.longitude}`;
        const locationUpdatedAt = new Date(latestLocation.captured_at).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit"
        });
        setManagers(prevManagers => 
          prevManagers.map(mgr => 
            mgr.id === managerId 
              ? { ...mgr, location: locationStr, locationUpdatedAt, hasLocationData: true }
              : mgr
          )
        );
      } else {
        // If no location data found, try fetching attendance log as fallback
        console.log(`No location data found for manager ${managerId} on ${dateString}, trying attendance log...`);
        const attendanceLog = await fetchAttendanceLogForDate(managerId, dateString);
        
        if (attendanceLog) {
          // Attendance log found, but it doesn't contain location data
          // We'll show a message indicating attendance was recorded but no location is available
          console.log(`Attendance log found for manager ${managerId} but no location data available`);
          setNoLocationData(prev => ({ ...prev, [managerId]: true }));
          setManagerLocations(prev => ({ ...prev, [managerId]: [] }));
          setManagers(prevManagers => 
            prevManagers.map(mgr => 
              mgr.id === managerId 
                ? { ...mgr, location: "Attendance recorded - No location data", locationUpdatedAt: new Date(attendanceLog.created_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit"
                  }), hasLocationData: false }
                : mgr
            )
          );
        } else {
          // No data found at all
          setNoLocationData(prev => ({ ...prev, [managerId]: true }));
          setManagerLocations(prev => ({ ...prev, [managerId]: [] }));
          setManagers(prevManagers => 
            prevManagers.map(mgr => 
              mgr.id === managerId 
                ? { ...mgr, location: "", locationUpdatedAt: null, hasLocationData: false }
                : mgr
            )
          );
        }
      }
    } catch (e) {
      console.error(`Error fetching location for manager ${managerId}:`, e);
      setNoLocationData(prev => ({ ...prev, [managerId]: true }));
    }
  };

  // Handle date change for a specific manager
  const handleDateChange = (managerId: string, date: Date) => {
    setManagerDates(prev => ({ ...prev, [managerId]: date }));
    // Pass the date directly to avoid stale state issues
    fetchManagerLocation(managerId, date);

    // Close the popover
    const trigger = document.querySelector(`[data-manager-id="${managerId}"]`);
    if (trigger instanceof HTMLElement) {
      trigger.click();
    }
  };

  const handleExpandClick = (managerId: string) => {
    const isExpanding = expandedManagerId !== managerId;
    setExpandedManagerId(isExpanding ? managerId : null);
    
    if (isExpanding) {
      // Fetch location data when expanding
      fetchManagerLocation(managerId);
    } else {
      // Reset date to today when collapsing
      setManagerDates(prev => {
        const newDates = { ...prev };
        delete newDates[managerId];
        return newDates;
      });
    }
  };

  const searchedManagers = managers.filter((manager: any) => {
    return manager.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      manager.email.toLowerCase().includes(searchQuery.toLowerCase());
  });
  const todaySet = useMemo(() => new Set(todayCheckedInIds), [todayCheckedInIds]);
  const filteredManagers = statusFilter === 'all'
    ? searchedManagers
    : searchedManagers.filter((m: any) => statusFilter === 'active' ? todaySet.has(m.id) : !todaySet.has(m.id));

  const total = filteredManagers.length;
  const start = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const end = Math.min(total, (page + 1) * PAGE_SIZE);
  const pagedManagers = filteredManagers.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
        <h1 className="text-2xl font-bold text-[#228B22]">Manager Management</h1>
          <p className="text-sm text-[#6B8E23]">Showing approved managers only</p>
        </div>
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchManagers} 
            disabled={isLoading}
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
            placeholder="Search managers..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={(v: 'all'|'active'|'inactive') => setStatusFilter(v)}>
            <SelectTrigger className="w-[140px] bg-white">
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
        {pagedManagers.length > 0 ? (
          pagedManagers.map((manager: any) => (
            <Card key={manager.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <Avatar className="h-10 w-10 border border-[#F4A460]">
                      <AvatarImage src={manager.avatar} alt={manager.name} />
                      <AvatarFallback className="bg-[#6B8E23] text-white">{getInitials(manager.name)}</AvatarFallback>
                    </Avatar>
                  <div className="flex-1">
                      <div className="font-medium">{manager.name}</div>
                      <div className="text-sm text-[#6B8E23] flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {manager.email}
                      </div>
                    </div>

                  <div className="hidden md:flex items-center gap-4">
                    <button
                      onClick={() => handleExpandClick(manager.id)}
                      className="p-0"
                    >
                      <ChevronDown
                        className={`h-4 w-4 transition-transform text-[#6B8E23] ${
                          expandedManagerId === manager.id ? "rotate-180 text-[#D3D3D3]" : ""
                        }`}
                      />
                    </button>

                    <ManagerDetailsPopup manager={manager} />
                  </div>
                  </div>

                <div className="md:hidden mt-2 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleExpandClick(manager.id)}
                      className="p-0"
                    >
                      <ChevronDown
                        className={`h-3 w-3 transition-transform text-[#6B8E23] ${
                          expandedManagerId === manager.id ? "rotate-180 text-[#D3D3D3]" : ""
                        }`}
                      />
                    </button>
                    <ManagerDetailsPopup manager={manager} />
                  </div>
                </div>

                {expandedManagerId === manager.id && (
                  <div className="mt-4">
                    <div className="relative">
                      <div 
                        className="w-full bg-gray-100 rounded-lg overflow-hidden" 
                        style={{ height: "350px" }}
                        data-map-container={manager.id}
                      >
                        {manager.hasLocationData ? (
                          managerLocations[manager.id] && managerLocations[manager.id].length > 0 ? (
                            <MapboxMap
                              employeeId={manager.id}
                              showPath={true}
                              locations={managerLocations[manager.id]}
                              containerType="movement-path"
                              height="400px"
                            />
                          ) : (manager.currentLogId || manager.lastLogId) ? (
                            <MapboxMap
                              employeeId={manager.id}
                              showPath={true}
                              attendanceLogId={manager.currentLogId || undefined}
                              containerType="movement-path"
                              height="400px"
                            />
                          ) : (
                            <MapboxMap
                              employeeId={manager.id}
                              location={manager.location}
                              containerType="current-location"
                              height="300px"
                            />
                          )
                        ) : (
                          <div className="h-full flex items-center justify-center">
                             <div className="text-center p-4">
                               {/* <p className="text-gray-500">Date not selected</p> */}
                                <CalendarIcon className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                               <p className="text-gray-500 font-medium">No location data available for {managerDates[manager.id] ? format(managerDates[manager.id], "PPP") : "today"}.</p>
                               <p className="text-gray-400 text-sm mt-1">Try selecting a different date or check if the employee was active on this day.</p>
                             </div>
                           </div>
                        )}
                      </div>
                      <div className="mt-2 bg-[#F4FAF4] p-3 rounded-lg">
                        <div className="flex justify-between items-center">
                          <Popover>
                            <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className="ml-auto flex items-center gap-2 text-[#6B8E23]"
                              size="sm"
                              data-manager-id={manager.id}
                            >
                                <CalendarIcon className="h-3 w-3 mr-1" />
                                {managerDates[manager.id] ? format(managerDates[manager.id], "PPP") : "Today"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="end">
                              <Calendar
                                  mode="single"
                                  selected={managerDates[manager.id] || new Date()}
                                  onSelect={(date) => date && handleDateChange(manager.id, date)}
                                  disabled={(date) => date > new Date() || date < new Date("2000-01-01")}
                                  initialFocus
                                />
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>
                    </div>
                  </div>
                  )}
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="text-center p-8">
            <div className="text-[#D3D3D3] mb-2">No managers found</div>
            <div className="text-sm">Try adjusting your search criteria</div>
          </div>
        )}
      </div>
    </div>
  );
}
