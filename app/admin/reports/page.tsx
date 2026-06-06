"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Download, X, ChevronLeft, ChevronRight, Loader2 } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { supabase } from "@/lib/supabaseClient"
import { startOfMonth, endOfMonth, format, addMonths, subMonths, eachDayOfInterval, isSameDay } from "date-fns"
import ExcelJS from "exceljs"

interface UserInfo {
  id: string;
  name: string;
}

interface AttendanceRecord {
  id: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    phone: string;
    driving_license?: string;
    aadhar_number?: string;
    pan_number?: string;
    cadre?: { name: string };
    manager?: { name: string } | null;
    manager_id?: string | null;
    state?: { state_name: string };
    district?: { district_name: string };
    mandal?: { mandal_name: string };
  } | null;
  check_in: string;
  check_out: string | null;
  duration_minutes: number;
  check_in_meter_reading: string;
  check_out_meter_reading: string | null;
  check_in_meter_image: string;
  check_out_meter_image: string | null;
  distance_traveled: number;
  created_at: string;
}

interface FarmerCollection {
  id: string;
  created_at: string;
  name: string;
  mobile_number: string;
  email?: string;
  crop?: { name: string };
  company?: { name: string };
  state?: { state_name: string };
  district?: { district_name: string };
  mandal?: { mandal_name: string };
  village?: string | null;
  // village?: { name: string };
  social_media?: string;
  collected_by?: {
    name: string;
    cadre?: { name: string };
  } | null;
}

interface SummaryUserInfo {
  id: string;
  name: string;
  email: string;
  role: string;
  manager_id?: string | null;
  phone?: string | null;
  cadre?: { name: string } | null;
}

interface DailyAttendance {
  date: string;
  dayOfMonth: number;
  checkIn: string | null;
  checkOut: string | null;
  loginHours: number;
  attendance: string;
}

interface UserAttendance {
  user: SummaryUserInfo;
  dailyAttendance: DailyAttendance[];
}

export default function Reports() {
  const { user } = useAuth()
  const [fromDate, setFromDate] = useState<Date>(() => {
    const today = new Date()
    const firstDay = new Date(Date.UTC(today.getFullYear(), today.getMonth(), 1))
    return firstDay
  })
  const [toDate, setToDate] = useState<Date>(() => {
    const today = new Date()
    const utcToday = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999))
    return utcToday
  })
  const [userType, setUserType] = useState<"all" | "employee" | "manager">("all")

  // New state for manager/employee filtering
  const [managersList, setManagersList] = useState<UserInfo[]>([])
  const [selectedManagerId, setSelectedManagerId] = useState<string>("all") // "all" or specific manager ID
  const [employeesList, setEmployeesList] = useState<UserInfo[]>([])
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("all") // "all" or specific employee ID
  const [allEmployeesList, setAllEmployeesList] = useState<UserInfo[]>([]) // Added state for all employees
  const [employeeDropdownUnderManagerTouched, setEmployeeDropdownUnderManagerTouched] = useState(false); // State for dropdown interaction

  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([])
  const [farmerCollections, setFarmerCollections] = useState<FarmerCollection[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [activeTab, setActiveTab] = useState("attendance")
  const [attendancePage, setAttendancePage] = useState(0)
  const [farmerPage, setFarmerPage] = useState(0)
  const [summaryPage, setSummaryPage] = useState(0)
  const PAGE_SIZE = 50

  // Attendance Summary state
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const today = new Date()
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`
  })
  const [summaryUserType, setSummaryUserType] = useState<"employee" | "manager">("employee")
  const [summaryManagersList, setSummaryManagersList] = useState<SummaryUserInfo[]>([])
  const [summarySelectedManagerId, setSummarySelectedManagerId] = useState<string>("all")
  const [summaryEmployeesList, setSummaryEmployeesList] = useState<SummaryUserInfo[]>([])
  const [summarySelectedEmployeeId, setSummarySelectedEmployeeId] = useState<string>("all")
  const [summaryAllEmployeesList, setSummaryAllEmployeesList] = useState<SummaryUserInfo[]>([])
  const [summaryEmployeeDropdownTouched, setSummaryEmployeeDropdownTouched] = useState(false)
  const [attendanceSummaryData, setAttendanceSummaryData] = useState<UserAttendance[]>([])
  const [daysInMonth, setDaysInMonth] = useState<string[]>([])

  // Fetch active managers or all active employees based on userType
  useEffect(() => {
    if (userType === 'manager') {
      fetchActiveManagers();
      setSelectedEmployeeId("all"); // Reset employee selection
      setEmployeesList([]); // Clear specific manager's employee list
    } else if (userType === 'employee') {
      fetchAllActiveEmployees();
      setSelectedManagerId("all"); // Reset manager selection
      setManagersList([]); // Clear manager list
    } else {
      // Reset both if userType is 'all'
      setSelectedManagerId("all");
      setSelectedEmployeeId("all");
      setManagersList([]);
      setEmployeesList([]);
      setAllEmployeesList([]); // Clear all employee list too
    }
  }, [userType]);

  // Fetch employees when a specific manager is selected (only if userType is manager)
  useEffect(() => {
    if (userType === 'manager' && selectedManagerId !== "all") {
      setEmployeeDropdownUnderManagerTouched(false); // Reset touch state
      fetchEmployeesForManager(selectedManagerId);
    } else if (userType === 'manager') {
      // If 'All Managers' is selected under 'manager' type, clear the specific employee list
      setEmployeesList([]);
      setSelectedEmployeeId("all"); // Reset employee selection
    }
    // No dependency on selectedManagerId when userType is 'employee' or 'all'
  }, [selectedManagerId, userType]); // Added userType dependency

  // Fetch records when filters change
  useEffect(() => {
    if (activeTab === "attendance") {
      fetchAttendanceRecords()
    } else {
      fetchFarmerCollections()
    }
    // Add selectedManagerId and selectedEmployeeId to dependencies
  }, [fromDate, toDate, userType, activeTab, selectedManagerId, selectedEmployeeId])

  // Reset pagination on major filter changes or tab switch
  useEffect(() => { setAttendancePage(0) }, [fromDate, toDate, userType, selectedManagerId, selectedEmployeeId])
  useEffect(() => { setFarmerPage(0) }, [fromDate, toDate, userType, selectedManagerId, selectedEmployeeId])
  useEffect(() => {
    if (activeTab === 'attendance') setAttendancePage(0); 
    else if (activeTab === 'farmer') setFarmerPage(0);
    else setSummaryPage(0)
  }, [activeTab])

  // Reset summary page on filter changes
  useEffect(() => {
    setSummaryPage(0)
  }, [selectedMonth, summaryUserType, summarySelectedManagerId, summarySelectedEmployeeId])

  // Attendance Summary useEffects
  useEffect(() => {
    if (summaryUserType === 'manager') {
      fetchSummaryActiveManagers()
      setSummarySelectedEmployeeId("all")
      setSummaryEmployeesList([])
    } else if (summaryUserType === 'employee') {
      fetchSummaryAllActiveEmployees()
      setSummarySelectedManagerId("all")
      setSummaryManagersList([])
    }
  }, [summaryUserType])

  useEffect(() => {
    if (summaryUserType === 'manager' && summarySelectedManagerId !== "all") {
      setSummaryEmployeeDropdownTouched(false)
      fetchSummaryEmployeesForManager(summarySelectedManagerId)
    } else if (summaryUserType === 'manager') {
      setSummaryEmployeesList([])
      setSummarySelectedEmployeeId("all")
    }
  }, [summarySelectedManagerId, summaryUserType])

  useEffect(() => {
    if (activeTab === "summary") {
      fetchAttendanceSummary()
    }
  }, [selectedMonth, summaryUserType, summarySelectedManagerId, summarySelectedEmployeeId, activeTab])

  const fetchActiveManagers = async () => {
    setIsLoading(true); // Indicate loading
    const { data, error } = await supabase
      .from('users')
      .select('id, name')
      .eq('role', 'manager')
      .eq('status', 'approved') // Assuming 'approved' means active, adjust if needed
      .order('name');

    if (error) {
      console.error("Error fetching managers:", error);
      setManagersList([]);
    } else {
      setManagersList(data || []);
    }
    setIsLoading(false); // End loading
  };

  const fetchAllActiveEmployees = async () => {
    setIsLoading(true); // Indicate loading
    const { data, error } = await supabase
      .from('users')
      .select('id, name')
      .eq('role', 'employee')
      .eq('status', 'approved') // Assuming 'approved' means active
      .order('name');

    if (error) {
      console.error("Error fetching all employees:", error);
      setAllEmployeesList([]);
    } else {
      setAllEmployeesList(data || []);
    }
    setSelectedEmployeeId("all"); // Default to "all" when list is fetched/refetched
    setIsLoading(false); // End loading
  };

  const fetchEmployeesForManager = async (managerId: string) => {
    setIsLoading(true); // Indicate loading
    const { data, error } = await supabase
      .from('users')
      .select('id, name')
      .eq('role', 'employee')
      .eq('manager_id', managerId)
      .eq('status', 'approved') // Assuming 'approved' means active, adjust if needed
      .order('name');

    if (error) {
      console.error(`Error fetching employees for manager ${managerId}:`, error);
      setEmployeesList([]);
    } else {
      setEmployeesList(data || []);
    }
    setSelectedEmployeeId(""); // Reset employee selection to empty string
    setIsLoading(false); // End loading
  };


  const fetchAttendanceRecords = async () => {
    if (!user) return;
    setIsLoading(true);
    setAttendanceRecords([]); // Clear previous results

    try {
      let query = supabase
        .from('attendance_logs')
        .select(`
          id,
          check_in,
          check_out,
          duration_minutes,
          check_in_meter_reading,
          check_out_meter_reading,
          check_in_meter_image,
          check_out_meter_image,
          distance_traveled,
          created_at,
          user:users!inner(
            id,
            name,
            email,
            role,
            phone,
            driving_license,
            aadhar_number,
            pan_number,
            cadre:cadres(name),
            state:states(state_name),
            district:districts(district_name),
            mandal:mandals(mandal_name),
            manager_id
          )
        `)
        .gte('check_in', fromDate.toISOString())
        .lte('check_in', toDate.toISOString()); // Chain query methods

      // Apply filters based on user type and selections
      if (userType === "manager") {
        if (selectedManagerId !== "all") {
          if (selectedEmployeeId === "") {
            query = query.eq('user.id', selectedManagerId);
          } else if (selectedEmployeeId === "all") {
            query = query.or(`id.eq.${selectedManagerId},and(manager_id.eq.${selectedManagerId},role.eq.employee)`, { referencedTable: 'users' });
          } else {
            query = query.eq('user.id', selectedEmployeeId);
          }
        } else {
          query = query.eq('user.role', 'manager');
        }
      } else if (userType === "employee") {
        query = query.eq('user.role', 'employee');
        if (selectedEmployeeId !== "all") {
          query = query.eq('user.id', selectedEmployeeId);
        }
      } // No specific role filter if userType is "all"
      
      // Add ordering - Removed referencedTable as it caused issues with joins/filters
      query = query.order('check_in', { ascending: false });

      // Execute the query - Use 'any' for initial data to simplify handling
      const { data: initialData, error } = await query.returns<any[]>(); // Use .returns<any[]>()

      if (error) {
        console.error("Error fetching attendance records:", error);
        // setAttendanceRecords([]); // Already cleared at the start
        return;
      }

      if (initialData && initialData.length > 0) {
        // Extract manager IDs safely
        const managerIds = [
          ...new Set(
            initialData
              .map((record) => record.user?.manager_id)
              .filter((id): id is string => !!id) 
          ),
        ];

        // Fetch manager names
        let managerMap = new Map<string, string>();
        if (managerIds.length > 0) {
          const { data: managerData, error: managerError } = await supabase
            .from('users')
            .select('id, name')
            .in('id', managerIds);
          if (!managerError && managerData) {
            managerMap = new Map(managerData.map((m) => [m.id, m.name]));
          } else if (managerError) {
             console.error("Error fetching manager data:", managerError);
          }
        }

        // Map the raw data to the strict AttendanceRecord interface
        const finalRecords: AttendanceRecord[] = initialData.map((record) => {
          const userRecord = record.user;
          // Helper to safely get the first item from a potential array or return undefined
          const getFirst = (arr: any) => (Array.isArray(arr) && arr.length > 0 ? arr[0] : undefined);
          
          return {
            // Map attendance_log fields directly
            id: record.id,
            check_in: record.check_in,
            check_out: record.check_out,
            duration_minutes: record.duration_minutes,
            check_in_meter_reading: record.check_in_meter_reading,
            check_out_meter_reading: record.check_out_meter_reading,
            check_in_meter_image: record.check_in_meter_image,
            check_out_meter_image: record.check_out_meter_image,
            distance_traveled: record.distance_traveled,
            created_at: record.created_at,
            // Map user fields, handling potential nulls and nested arrays
            user: userRecord ? {
                id: userRecord.id,
                name: userRecord.name,
                email: userRecord.email,
                role: userRecord.role,
                phone: userRecord.phone,
                driving_license: userRecord.driving_license,
                aadhar_number: userRecord.aadhar_number,
                pan_number: userRecord.pan_number,
                manager_id: userRecord.manager_id,
                cadre: userRecord.cadre,
                state: userRecord.state,
                district: userRecord.district,
                mandal: userRecord.mandal,
                manager: userRecord.manager_id ? { name: managerMap.get(userRecord.manager_id) || "N/A" } : null,
              } : null,
          } as AttendanceRecord; // Assert type for the final object
        });
        
        setAttendanceRecords(finalRecords);

      } // No else needed, already cleared at the start
    } catch (err) {
      console.error("Error processing attendance records:", err);
      // setAttendanceRecords([]); // Already cleared at the start
    } finally {
      setIsLoading(false);
    }
  };

  const fetchFarmerCollections = async () => {
    if (!user) return
    setIsLoading(true)
    setFarmerCollections([]); // Clear previous results

    try {
      // Base query
      let query = supabase
        .from('farmers')
        .select(`
          id,
          created_at,
          name,
          mobile_number,
          email,
          crop:crops(name),
          company:companies(name),
          state:states(state_name),
          district:districts(district_name),
          mandal:mandals(mandal_name),
          village,
          social_media,
          collected_by:users!inner(
            id,
            name,
            role,
            manager_id,
            cadre:cadres(name)
          )
        `)
        .gte('created_at', fromDate.toISOString())
        .lte('created_at', toDate.toISOString());

      // Apply filters based on user type and selections - Mirroring attendance logic
      if (userType === "manager") {
        if (selectedManagerId !== "all") {
            if (selectedEmployeeId === "") {
                query = query.eq('collected_by.id', selectedManagerId);
            } else if (selectedEmployeeId === "all") {
                query = query.or(`id.eq.${selectedManagerId},and(manager_id.eq.${selectedManagerId},role.eq.employee)`, { referencedTable: 'collected_by' });
            } else {
                query = query.eq('collected_by.id', selectedEmployeeId);
            }
        } else {
          query = query.eq('collected_by.role', 'manager');
        }
      } else if (userType === "employee") {
        query = query.eq('collected_by.role', 'employee');
        if (selectedEmployeeId !== "all") {
          query = query.eq('collected_by.id', selectedEmployeeId);
        }
      }
      // No specific role filter if userType is "all"

      // Add ordering
      query = query.order('created_at', { ascending: false });
 
      // Execute the query
      const { data, error } = await query.returns<any[]>();
      
      if (error) {
        console.error("Error fetching farmer collections:", error);
        return;
      }
      
      // Map the raw data to the strict FarmerCollection interface
      const finalData: FarmerCollection[] = (data || []).map(farmer => {
          // Removed getFirst helper as joins return objects, not arrays
          // const getFirst = (arr: any) => (Array.isArray(arr) && arr.length > 0 ? arr[0] : undefined);
          const collectedBy = farmer.collected_by; // Directly assign object
 
          return {
              id: farmer.id,
              created_at: farmer.created_at,
              name: farmer.name,
              mobile_number: farmer.mobile_number,
              email: farmer.email,
              social_media: farmer.social_media,
              crop: farmer.crop, // Removed getFirst
              company: farmer.company, // Removed getFirst
              state: farmer.state, // Removed getFirst
              district: farmer.district, // Removed getFirst
              mandal: farmer.mandal, // Removed getFirst
              village: farmer.village, // Removed getFirst
              collected_by: collectedBy ? {
                  name: collectedBy.name,
                  cadre: collectedBy.cadre // Removed getFirst
              } : null
          } as FarmerCollection;
      });
 
      setFarmerCollections(finalData);
    } catch (err) {
      console.error("Error processing farmer collections:", err);
    } finally {
      setIsLoading(false)
    }
  };

  // Function to reset filters to default
  const clearFilters = () => {
    // Reset Date Range
    const today = new Date();
    setFromDate(new Date(Date.UTC(today.getFullYear(), today.getMonth(), 1)));
    setToDate(new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999)));
    // Reset User Type (this will trigger useEffects to reset manager/employee lists/selections)
    setUserType("all");
  };

  const exportAttendanceToCSV = () => {
    const headers = [
      "Employee Name",
      "Email",
      "Phone",
      "Role",
      "Manager",
      "Cadre",
      "Check In Date",
      "Check In Time",
      "Check Out Date",
      "Check Out Time",
      "Duration (mins)",
      "Distance (km)",
      "Aadhar Number",
      "Driving License",
      "PAN Number",
      "State",
      "District",
      "Mandal",
      "Check In Meter Reading",
      "Check Out Meter Reading",
      "Check In Meter Image",
      "Check Out Meter Image"
    ]

    const csvData = attendanceRecords.map(record => {
      // Format Aadhar Number and Driving License as strings to prevent scientific notation
      const aadharNumber = record.user?.aadhar_number ? `="${record.user.aadhar_number}"` : "N/A"
      const drivingLicense = record.user?.driving_license ? `="${record.user.driving_license}"` : "N/A"

      return {
        "Employee Name": record.user?.name || "N/A",
        "Email": record.user?.email || "N/A",
        "Phone": record.user?.phone || "N/A",
        "Role": record.user?.role || "N/A",
        "Manager": record.user?.manager?.name || "N/A",
        "Cadre": record.user?.cadre?.name || "N/A",
        "Check In Date": format(new Date(record.check_in), "dd-MM-yyyy"),
        "Check In Time": format(new Date(record.check_in), "HH:mm"),
        "Check Out Date": record.check_out ? format(new Date(record.check_out), "dd-MM-yyyy") : "Not Checked Out",
        "Check Out Time": record.check_out ? format(new Date(record.check_out), "HH:mm") : "Not Checked Out",
        "Duration (mins)": record.duration_minutes || "N/A",
        "Distance (km)": record.distance_traveled || "N/A",
        "Aadhar Number": aadharNumber,
        "Driving License": drivingLicense,
        "PAN Number": record.user?.pan_number || "N/A",
        "State": record.user?.state?.state_name || "N/A",
        "District": record.user?.district?.district_name || "N/A",
        "Mandal": record.user?.mandal?.mandal_name || "N/A",
        "Check In Meter Reading": record.check_in_meter_reading || "N/A",
        "Check Out Meter Reading": record.check_out_meter_reading || "N/A",
        "Check In Meter Image": record.check_in_meter_image || "N/A",
        "Check Out Meter Image": record.check_out_meter_image || "N/A"
      }
    })

    const csvContent = [
      headers.join(","),
      ...csvData.map(row => 
        Object.values(row).map(value => 
          String(value).includes(",") ? `"${String(value).replace(/"/g, '""')}"` : value
        ).join(",")
      )
    ].join("\n")

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `attendance_records_${format(fromDate, 'dd-MM-yyyy')}_to_${format(toDate, 'dd-MM-yyyy')}.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const exportFarmerCollectionsToCSV = () => {
    const headers = [
     
      "Farmer Name",
      "Mobile Number",
      "Email",
      "Crop",
      "Company",
      "State",
      "District",
      "Mandal",
      "Village",
      "Social Media",
      "Collected By",
      "Collector Cadre",
      "Collection Date",
      "Collection Time",
    ]

    const csvData = farmerCollections.map(collection => ({
     
      "Farmer Name": collection.name || "N/A",
      "Mobile Number": collection.mobile_number || "N/A",
      "Email": collection.email || "N/A",
      "Crop": collection.crop?.name || "N/A",
      "Company": collection.company?.name || "N/A",
      "State": collection.state?.state_name || "N/A",
      "District": collection.district?.district_name || "N/A",
      "Mandal": collection.mandal?.mandal_name || "N/A",
      "Village": collection.village || "N/A",
      "Social Media": collection.social_media || "N/A",
      "Collected By": collection.collected_by?.name || "N/A",
      "Collector Cadre": collection.collected_by?.cadre?.name || "N/A",
       "Collection Date": format(new Date(collection.created_at), "dd-MM-yyyy"),
      "Collection Time": format(new Date(collection.created_at), "HH:mm"),
    }))

    const csvContent = [
      headers.join(","),
      ...csvData.map(row => 
        Object.values(row).map(value => 
          String(value).includes(",") ? `"${String(value).replace(/"/g, '""')}"` : value
        ).join(",")
      )
    ].join("\n")

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `farmer_collections_${format(fromDate, 'dd-MM-yyyy')}_to_${format(toDate, 'dd-MM-yyyy')}.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Attendance Summary functions
  const fetchSummaryActiveManagers = async () => {
    setIsLoading(true)
    const { data, error } = await supabase
      .from("users")
      .select("id, name, email, role, manager_id, phone, cadre:cadres(name)")
      .eq("role", "manager")
      .eq("status", "approved")
      .eq("is_deleted", false)
      .order("name")

    if (error) {
      console.error("Error fetching managers:", error)
      setSummaryManagersList([])
    } else {
      setSummaryManagersList(data || [])
    }
    setIsLoading(false)
  }

  const fetchSummaryAllActiveEmployees = async () => {
    setIsLoading(true)
    const { data, error } = await supabase
      .from("users")
      .select("id, name, email, role, manager_id, phone, cadre:cadres(name)")
      .eq("role", "employee")
      .eq("status", "approved")
      .eq("is_deleted", false)
      .order("name")

    if (error) {
      console.error("Error fetching employees:", error)
      setSummaryAllEmployeesList([])
    } else {
      setSummaryAllEmployeesList(data || [])
    }
    setIsLoading(false)
  }

  const fetchSummaryEmployeesForManager = async (managerId: string) => {
    setIsLoading(true)
    const { data, error } = await supabase
      .from("users")
      .select("id, name, email, role, manager_id, phone, cadre:cadres(name)")
      .eq("role", "employee")
      .eq("manager_id", managerId)
      .eq("status", "approved")
      .eq("is_deleted", false)
      .order("name")

    if (error) {
      console.error("Error fetching employees for manager:", error)
      setSummaryEmployeesList([])
    } else {
      setSummaryEmployeesList(data || [])
    }
    setIsLoading(false)
  }

  const fetchAttendanceSummary = async () => {
    setIsLoading(true)
    try {
      // Calculate date range for the selected month
      const [year, monthNum] = selectedMonth.split("-").map(Number)
      const monthDate = new Date(year, monthNum - 1, 1)
      const start = startOfMonth(monthDate)
      const end = endOfMonth(monthDate)
      const days = eachDayOfInterval({ start, end })
      setDaysInMonth(days.map(d => format(d, "yyyy-MM-dd")))

      // Fetch relevant users based on filters
      let usersQuery = supabase
        .from("users")
        .select("id, name, email, role, manager_id, phone, cadre:cadres(name)")
        .eq("status", "approved")
        .eq("is_deleted", false)

      if (summaryUserType === "employee") {
        usersQuery = usersQuery.eq("role", "employee")
        if (summarySelectedEmployeeId && summarySelectedEmployeeId !== "all") {
          usersQuery = usersQuery.eq("id", summarySelectedEmployeeId)
        }
      } else if (summaryUserType === "manager") {
        if (summarySelectedManagerId && summarySelectedManagerId !== "all") {
          if (summarySelectedEmployeeId && summarySelectedEmployeeId !== "all" && summarySelectedEmployeeId !== "") {
            usersQuery = usersQuery.eq("id", summarySelectedEmployeeId)
          } else if (summarySelectedEmployeeId === "all") {
            usersQuery = usersQuery.or(`id.eq.${summarySelectedManagerId},and(manager_id.eq.${summarySelectedManagerId},role.eq.employee)`)
          } else {
            usersQuery = usersQuery.eq("id", summarySelectedManagerId)
          }
        } else {
          usersQuery = usersQuery.eq("role", "manager")
        }
      }

      const { data: users, error: usersError } = await usersQuery.order("name")
      if (usersError) throw usersError

      if (!users || users.length === 0) {
        setAttendanceSummaryData([])
        return
      }

      const userIds = users.map(u => u.id)

      // Fetch attendance logs
      const { data: logs, error: logsError } = await supabase
        .from("attendance_logs")
        .select("id, user_id, check_in, check_out")
        .in("user_id", userIds)
        .gte("check_in", start.toISOString())
        .lte("check_in", end.toISOString())
        .order("check_in", { ascending: true })

      if (logsError) throw logsError

      // Process data
      const result = users.map(u => {
        const userLogs = (logs || []).filter(log => log.user_id === u.id)

        const dailyAttendance = days.map(day => {
          const dayLogs = userLogs.filter(log => isSameDay(new Date(log.check_in), day))

          let checkIn: string | null = null
          let checkOut: string | null = null
          let loginHours: number = 0
          let attendance: string = "Absent"

          if (dayLogs.length > 0) {
            const sortedByCheckIn = [...dayLogs].sort((a, b) =>
              new Date(a.check_in).getTime() - new Date(b.check_in).getTime()
            )
            checkIn = sortedByCheckIn[0].check_in

            const checkOutLogs = dayLogs.filter(log => log.check_out !== null)
            if (checkOutLogs.length > 0) {
              const sortedByCheckOut = [...checkOutLogs].sort((a, b) =>
                new Date(b.check_out!).getTime() - new Date(a.check_out!).getTime()
              )
              checkOut = sortedByCheckOut[0].check_out

              // Calculate login hours
              const checkInDate = new Date(checkIn)
              const checkOutDate = new Date(checkOut)
              const diffMs = checkOutDate.getTime() - checkInDate.getTime()
              loginHours = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100 // 2 decimal places

              // Determine attendance status
              attendance = loginHours >= 9 ? "Present" : "Absent"
            } else {
              // No check out, login hours 0, attendance absent
              loginHours = 0
              attendance = "Absent"
            }
          }

          return {
            date: format(day, "yyyy-MM-dd"),
            dayOfMonth: day.getDate(),
            checkIn,
            checkOut,
            loginHours,
            attendance
          }
        })

        return { user: u, dailyAttendance }
      })

      setAttendanceSummaryData(result)
    } catch (err) {
      console.error("Error fetching attendance summary:", err)
    } finally {
      setIsLoading(false)
    }
  }

  const exportSummaryToExcel = async () => {
    if (attendanceSummaryData.length === 0 || daysInMonth.length === 0) return

    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet("Attendance Summary")

    // Build headers: Sl. No., Name, Email, Phone, Role, Cadre, then each date, then No. of Present, No. of Absent
    const headerRow = worksheet.addRow([
      "Sl. No.",
      "Employee Name",
      "Email",
      "Phone",
      "Role",
      "Cadre",
      ...daysInMonth.map(date => {
        const d = new Date(date)
        return `${format(d, "dd-MMM")}\n${format(d, "EEE")}`
      }),
      "No. of Present",
      "No. of Absent"
    ])

    // Style header row
    headerRow.eachCell(cell => {
      cell.font = { bold: true, size: 11 }
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFD3D3D3" }
      }
      cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true }
    })
    headerRow.height = 30

    // Fill data rows
    attendanceSummaryData.forEach((item, index) => {
      const presentCount = item.dailyAttendance.filter(day => day.attendance === "Present").length
      const absentCount = item.dailyAttendance.filter(day => day.attendance === "Absent").length

      const rowData: any[] = [
        index + 1,
        item.user.name,
        item.user.email,
        item.user.phone || "-",
        item.user.role,
        item.user.cadre?.name || "-"
      ]

      item.dailyAttendance.forEach(day => {
        let cellValue = ""
        if (day.checkIn) {
          cellValue += `In: ${format(new Date(day.checkIn), "hh:mm a")}\n`
          if (day.checkOut) {
            cellValue += `Out: ${format(new Date(day.checkOut), "hh:mm a")}\n`
          } else {
            cellValue += "Out: Not Checked Out\n"
          }
          cellValue += `Hours: ${day.loginHours.toFixed(2)}\n`
          cellValue += day.attendance
        } else {
          cellValue = "In: -\nOut: -\nHours: 0.00\nAbsent"
        }
        rowData.push(cellValue)
      })

      rowData.push(presentCount)
      rowData.push(absentCount)

      const row = worksheet.addRow(rowData)
      row.height = 80
      row.alignment = { vertical: "middle", horizontal: "center", wrapText: true }

      // Highlight present day cells
      item.dailyAttendance.forEach((day, dayIndex) => {
        if (day.attendance === "Present") {
          const cell = row.getCell(7 + dayIndex)
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFD5F5E3" }
          }
        }
      })
    })

    // Set column widths
    worksheet.getColumn(1).width = 8 // Sl. No.
    worksheet.getColumn(2).width = 20 // Employee Name
    worksheet.getColumn(3).width = 25 // Email
    worksheet.getColumn(4).width = 15 // Phone
    worksheet.getColumn(5).width = 12 // Role
    worksheet.getColumn(6).width = 15 // Cadre
    for (let i = 7; i <= 6 + daysInMonth.length; i++) {
      worksheet.getColumn(i).width = 18
    }
    worksheet.getColumn(7 + daysInMonth.length).width = 15 // No. of Present
    worksheet.getColumn(8 + daysInMonth.length).width = 15 // No. of Absent

    // Download file
    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `attendance-summary-${selectedMonth}.xlsx`
    link.click()
    URL.revokeObjectURL(url)
  }

  // Format time helper
  const formatSummaryTime = (timeStr: string | null) => {
    if (!timeStr) return ""
    return format(new Date(timeStr), "hh:mm a")
  }

  return (
    <TooltipProvider>
      <div className="p-4 md:p-6 space-y-6">
        <h1 className="text-2xl font-bold">Reports</h1>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 md:w-[600px]">
            <TabsTrigger value="attendance">Attendance Report</TabsTrigger>
            <TabsTrigger value="farmer">Farmer Collection Report</TabsTrigger>
            <TabsTrigger value="summary">Attendance Summary</TabsTrigger>
          </TabsList>
          <TabsContent value="attendance">
            <Card>
              <CardContent className="p-4 space-y-4">
                <div className="flex flex-wrap items-center gap-1">
                  {/* Date Pickers */}
                  <div className="flex items-center gap-1">
                    <label htmlFor="fromDate" className="text-sm font-medium">From:</label>
                    <Input
                      id="fromDate"
                      type="date"
                      value={format(fromDate, 'yyyy-MM-dd')}
                      onChange={(e) => setFromDate(new Date(e.target.value + 'T00:00:00Z'))}
                      className="w-auto"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <label htmlFor="toDate" className="text-sm font-medium">To:</label>
                    <Input
                      id="toDate"
                      type="date"
                      value={format(toDate, 'yyyy-MM-dd')}
                      onChange={(e) => setToDate(new Date(e.target.value + 'T23:59:59Z'))}
                      className="w-auto"
                    />
                  </div>
                  {/* User Type Selector */}
                  <div className="flex items-center gap-1">
                    <label htmlFor="userType" className="text-sm font-medium">User Type:</label>
                    <Select value={userType} onValueChange={(value: "all" | "employee" | "manager") => setUserType(value)}>
                      <SelectTrigger id="userType" className="w-[130px] focus:outline-none focus:ring-0">
                        <SelectValue placeholder="Select user type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Users</SelectItem>
                        <SelectItem value="employee">Employee</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Conditional Manager Selector */}
                  {userType === 'manager' && (
                    <div className="flex items-center gap-1">
                      <label htmlFor="managerSelect" className="text-sm font-medium">Manager:</label>
                      <Select value={selectedManagerId} onValueChange={setSelectedManagerId}>
                        <SelectTrigger id="managerSelect" className="w-[130px] focus:outline-none focus:ring-0">
                          <SelectValue placeholder="Select Manager" />
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

                  {/* Conditional Employee Selector (shown when Manager is selected AND specific manager is chosen) */}
                  {userType === 'manager' && selectedManagerId !== 'all' && (
                    <div className="flex items-center gap-1">
                      <label htmlFor="employeeSelectManager" className="text-sm font-medium">Employee:</label>
                      <Select 
                        value={employeeDropdownUnderManagerTouched ? selectedEmployeeId : ""} 
                        onValueChange={(value) => { 
                          setEmployeeDropdownUnderManagerTouched(true);
                          setSelectedEmployeeId(value);
                        }}
                      >
                        <SelectTrigger id="employeeSelectManager" className="w-[130px] focus:outline-none focus:ring-0">
                          <SelectValue placeholder="Select Employee" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Employees</SelectItem>
                          {employeesList.map(employee => (
                            <SelectItem key={employee.id} value={employee.id}>
                              {employee.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Conditional Employee Selector (shown when userType is 'employee') */}
                  {userType === 'employee' && (
                    <div className="flex items-center gap-1">
                      <label htmlFor="employeeSelectAll" className="text-sm font-medium">Employee:</label>
                      <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                        <SelectTrigger id="employeeSelectAll" className="w-[130px] focus:outline-none focus:ring-0">
                          <SelectValue placeholder="Select Employee" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Employees</SelectItem>
                          {allEmployeesList.map(employee => (
                            <SelectItem key={employee.id} value={employee.id}>
                              {employee.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Clear Filters Button - Icon only with Tooltip */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button onClick={clearFilters} variant="ghost" size="icon" className="">
                        <X className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Clear Filters</p>
                    </TooltipContent>
                  </Tooltip>

                  {/* Export Button - Icon only with Tooltip */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button onClick={exportAttendanceToCSV} variant="outline" size="icon" className="">
                        <Download className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Export CSV</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                {/* Pagination bar (Gmail style) */}
                <div className="flex items-center justify-end gap-2">
                  {(() => {
                    const total = attendanceRecords.length
                    const start = total === 0 ? 0 : attendancePage * PAGE_SIZE + 1
                    const end = Math.min(total, (attendancePage + 1) * PAGE_SIZE)
                    return (
                      <>
                        <span className="text-sm text-muted-foreground">{total === 0 ? '0 of 0' : `${start}-${end} of ${total}`}</span>
                        <Button variant="outline" size="icon" onClick={() => setAttendancePage(p => Math.max(0, p - 1))} disabled={attendancePage === 0}>
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="icon" onClick={() => setAttendancePage(p => p + 1)} disabled={end >= total}>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </>
                    )
                  })()}
                </div>
                {/* Attendance Table */}
                {isLoading ? (
                  <p>Loading attendance data...</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="whitespace-nowrap text-xs md:text-sm font-medium">Sl. No.</TableHead>
                          <TableHead className="whitespace-nowrap text-xs md:text-sm font-medium">Employee Name</TableHead>
                          <TableHead className="whitespace-nowrap text-xs md:text-sm font-medium">Email</TableHead>
                          <TableHead className="whitespace-nowrap text-xs md:text-sm font-medium">Phone</TableHead>
                          <TableHead className="whitespace-nowrap text-xs md:text-sm font-medium">Role</TableHead>
                          <TableHead className="whitespace-nowrap text-xs md:text-sm font-medium">Manager</TableHead>
                          <TableHead className="whitespace-nowrap text-xs md:text-sm font-medium">Cadre</TableHead>
                          <TableHead className="whitespace-nowrap text-xs md:text-sm font-medium">Check In Date</TableHead>
                          <TableHead className="whitespace-nowrap text-xs md:text-sm font-medium">Check In Time</TableHead>
                          <TableHead className="whitespace-nowrap text-xs md:text-sm font-medium">Check Out Date</TableHead>
                          <TableHead className="whitespace-nowrap text-xs md:text-sm font-medium">Check Out Time</TableHead>
                          <TableHead className="whitespace-nowrap text-xs md:text-sm font-medium">Duration (mins)</TableHead>
                          <TableHead className="whitespace-nowrap text-xs md:text-sm font-medium">Distance (km)</TableHead>
                          <TableHead className="whitespace-nowrap text-xs md:text-sm font-medium">Aadhar Number</TableHead>
                          <TableHead className="whitespace-nowrap text-xs md:text-sm font-medium">Driving License</TableHead>
                          <TableHead className="whitespace-nowrap text-xs md:text-sm font-medium">PAN Number</TableHead>
                          <TableHead className="whitespace-nowrap text-xs md:text-sm font-medium">State</TableHead>
                          <TableHead className="whitespace-nowrap text-xs md:text-sm font-medium">District</TableHead>
                          <TableHead className="whitespace-nowrap text-xs md:text-sm font-medium">Mandal</TableHead>
                          <TableHead className="whitespace-nowrap text-xs md:text-sm font-medium">Check In Meter</TableHead>
                          <TableHead className="whitespace-nowrap text-xs md:text-sm font-medium">Check Out Meter</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {attendanceRecords.length > 0 ? (
                          attendanceRecords
                            .slice(attendancePage * PAGE_SIZE, (attendancePage + 1) * PAGE_SIZE)
                            .map((record, index) => (
                            <TableRow key={record.id}>
                              <TableCell className="whitespace-nowrap text-xs md:text-sm">{attendancePage * PAGE_SIZE + index + 1}</TableCell>
                              <TableCell className="whitespace-nowrap text-xs md:text-sm">{record.user?.name || 'N/A'}</TableCell>
                              <TableCell className="whitespace-nowrap text-xs md:text-sm">{record.user?.email || 'N/A'}</TableCell>
                              <TableCell className="whitespace-nowrap text-xs md:text-sm">{record.user?.phone || 'N/A'}</TableCell>
                              <TableCell className="whitespace-nowrap text-xs md:text-sm">{record.user?.role || 'N/A'}</TableCell>
                              <TableCell className="whitespace-nowrap text-xs md:text-sm">{record.user?.manager?.name || '-'}</TableCell>
                              <TableCell className="whitespace-nowrap text-xs md:text-sm">{record.user?.cadre?.name || 'N/A'}</TableCell>
                              <TableCell className="whitespace-nowrap text-xs md:text-sm">{format(new Date(record.check_in), 'P')}</TableCell>
                              <TableCell className="whitespace-nowrap text-xs md:text-sm">{format(new Date(record.check_in), 'p')}</TableCell>
                              <TableCell className="whitespace-nowrap text-xs md:text-sm">{record.check_out ? format(new Date(record.check_out), 'P') : "-"}</TableCell>
                              <TableCell className="whitespace-nowrap text-xs md:text-sm">{record.check_out ? format(new Date(record.check_out), 'p') : "-"}</TableCell>
                              <TableCell className="whitespace-nowrap text-xs md:text-sm">{record.duration_minutes ? `${record.duration_minutes} min` : "-"}</TableCell>
                              <TableCell className="whitespace-nowrap text-xs md:text-sm">{record.distance_traveled ?? '-'}</TableCell>
                              <TableCell className="whitespace-nowrap text-xs md:text-sm">{record.user?.aadhar_number || 'N/A'}</TableCell>
                              <TableCell className="whitespace-nowrap text-xs md:text-sm">{record.user?.driving_license || 'N/A'}</TableCell>
                              <TableCell className="whitespace-nowrap text-xs md:text-sm">{record.user?.pan_number || 'N/A'}</TableCell>
                              <TableCell className="whitespace-nowrap text-xs md:text-sm">{record.user?.state?.state_name || 'N/A'}</TableCell>
                              <TableCell className="whitespace-nowrap text-xs md:text-sm">{record.user?.district?.district_name || 'N/A'}</TableCell>
                              <TableCell className="whitespace-nowrap text-xs md:text-sm">{record.user?.mandal?.mandal_name || 'N/A'}</TableCell>
                              <TableCell className="whitespace-nowrap text-xs md:text-sm">
                                {record.check_in_meter_reading}
                                {record.check_in_meter_image && 
                                  <a href={record.check_in_meter_image} target="_blank" rel="noopener noreferrer" className="ml-2 text-blue-600 hover:underline">(img)</a>}
                              </TableCell>
                              <TableCell className="whitespace-nowrap text-xs md:text-sm">
                                {record.check_out_meter_reading ?? '-'}
                                {record.check_out_meter_image && 
                                  <a href={record.check_out_meter_image} target="_blank" rel="noopener noreferrer" className="ml-2 text-blue-600 hover:underline">(img)</a>}
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={21} className="text-center">No attendance records found for the selected criteria.</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="farmer">
            <Card>
              <CardContent className="p-4 space-y-4">
                <div className="flex flex-wrap items-center gap-1">
                  <div className="flex items-center gap-1">
                    <label htmlFor="farmerFromDate" className="text-sm font-medium">From:</label>
                    <Input
                      id="farmerFromDate"
                      type="date"
                      value={format(fromDate, 'yyyy-MM-dd')}
                      onChange={(e) => setFromDate(new Date(e.target.value + 'T00:00:00Z'))}
                      className="w-auto"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <label htmlFor="farmerToDate" className="text-sm font-medium">To:</label>
                    <Input
                      id="farmerToDate"
                      type="date"
                      value={format(toDate, 'yyyy-MM-dd')}
                      onChange={(e) => setToDate(new Date(e.target.value + 'T23:59:59Z'))}
                      className="w-auto"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <label htmlFor="farmerUserType" className="text-sm font-medium">User Type:</label>
                    <Select value={userType} onValueChange={(value: "all" | "employee" | "manager") => setUserType(value)}>
                      <SelectTrigger id="farmerUserType" className="w-[130px] focus:outline-none focus:ring-0">
                        <SelectValue placeholder="Select user type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Users</SelectItem>
                        <SelectItem value="employee">Employee</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {userType === 'manager' && (
                    <div className="flex items-center gap-1">
                      <label htmlFor="farmerManagerSelect" className="text-sm font-medium">Manager:</label>
                      <Select value={selectedManagerId} onValueChange={setSelectedManagerId}>
                        <SelectTrigger id="farmerManagerSelect" className="w-[130px] focus:outline-none focus:ring-0">
                          <SelectValue placeholder="Select Manager" />
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

                  {userType === 'manager' && selectedManagerId !== 'all' && (
                    <div className="flex items-center gap-1">
                      <label htmlFor="farmerEmployeeSelectManager" className="text-sm font-medium">Employee:</label>
                      <Select 
                        value={employeeDropdownUnderManagerTouched ? selectedEmployeeId : ""} 
                        onValueChange={(value) => { 
                          setEmployeeDropdownUnderManagerTouched(true);
                          setSelectedEmployeeId(value);
                        }}
                      >
                        <SelectTrigger id="farmerEmployeeSelectManager" className="w-[130px] focus:outline-none focus:ring-0">
                          <SelectValue placeholder="Select Employee" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Employees</SelectItem>
                          {employeesList.map(employee => (
                            <SelectItem key={employee.id} value={employee.id}>
                              {employee.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {userType === 'employee' && (
                    <div className="flex items-center gap-1">
                      <label htmlFor="farmerEmployeeSelectAll" className="text-sm font-medium">Employee:</label>
                      <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                        <SelectTrigger id="farmerEmployeeSelectAll" className="w-[130px] focus:outline-none focus:ring-0">
                          <SelectValue placeholder="Select Employee" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Employees</SelectItem>
                          {allEmployeesList.map(employee => (
                            <SelectItem key={employee.id} value={employee.id}>
                              {employee.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button onClick={clearFilters} variant="ghost" size="icon" className="">
                        <X className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Clear Filters</p>
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button onClick={exportFarmerCollectionsToCSV} variant="outline" size="icon" className="">
                        <Download className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Export CSV</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                {/* Pagination bar (Gmail style) */}
                <div className="flex items-center justify-end gap-2">
                  {(() => {
                    const total = farmerCollections.length
                    const start = total === 0 ? 0 : farmerPage * PAGE_SIZE + 1
                    const end = Math.min(total, (farmerPage + 1) * PAGE_SIZE)
                    return (
                      <>
                        <span className="text-sm text-muted-foreground">{total === 0 ? '0 of 0' : `${start}-${end} of ${total}`}</span>
                        <Button variant="outline" size="icon" onClick={() => setFarmerPage(p => Math.max(0, p - 1))} disabled={farmerPage === 0}>
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="icon" onClick={() => setFarmerPage(p => p + 1)} disabled={end >= total}>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </>
                    )
                  })()}
                </div>

                {isLoading ? (
                  <p>Loading farmer collections...</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="whitespace-nowrap text-xs md:text-sm font-medium">Sl. No.</TableHead>
                          <TableHead className="whitespace-nowrap text-xs md:text-sm font-medium">Farmer Name</TableHead>
                          <TableHead className="whitespace-nowrap text-xs md:text-sm font-medium">Mobile Number</TableHead>
                          <TableHead className="whitespace-nowrap text-xs md:text-sm font-medium">Email</TableHead>
                          <TableHead className="whitespace-nowrap text-xs md:text-sm font-medium">Crop</TableHead>
                          <TableHead className="whitespace-nowrap text-xs md:text-sm font-medium">Company</TableHead>
                          <TableHead className="whitespace-nowrap text-xs md:text-sm font-medium">State</TableHead>
                          <TableHead className="whitespace-nowrap text-xs md:text-sm font-medium">District</TableHead>
                          <TableHead className="whitespace-nowrap text-xs md:text-sm font-medium">Mandal</TableHead>
                          <TableHead className="whitespace-nowrap text-xs md:text-sm font-medium">Village</TableHead>
                          <TableHead className="whitespace-nowrap text-xs md:text-sm font-medium">Social Media</TableHead>
                          <TableHead className="whitespace-nowrap text-xs md:text-sm font-medium">Collected By</TableHead>
                          <TableHead className="whitespace-nowrap text-xs md:text-sm font-medium">Collector Cadre</TableHead>
                          <TableHead className="whitespace-nowrap text-xs md:text-sm font-medium">Collection Date</TableHead>
                          <TableHead className="whitespace-nowrap text-xs md:text-sm font-medium">Collection Time</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {farmerCollections.length > 0 ? (
                          farmerCollections
                            .slice(farmerPage * PAGE_SIZE, (farmerPage + 1) * PAGE_SIZE)
                            .map((farmer, index) => (
                              <TableRow key={farmer.id}>
                                <TableCell className="whitespace-nowrap text-xs md:text-sm">{farmerPage * PAGE_SIZE + index + 1}</TableCell>
                                <TableCell className="whitespace-nowrap text-xs md:text-sm">{farmer.name || 'N/A'}</TableCell>
                                <TableCell className="whitespace-nowrap text-xs md:text-sm">{farmer.mobile_number || 'N/A'}</TableCell>
                                <TableCell className="whitespace-nowrap text-xs md:text-sm">{farmer.email || 'N/A'}</TableCell>
                                <TableCell className="whitespace-nowrap text-xs md:text-sm">{farmer.crop?.name || 'N/A'}</TableCell>
                                <TableCell className="whitespace-nowrap text-xs md:text-sm">{farmer.company?.name || 'N/A'}</TableCell>
                                <TableCell className="whitespace-nowrap text-xs md:text-sm">{farmer.state?.state_name || 'N/A'}</TableCell>
                                <TableCell className="whitespace-nowrap text-xs md:text-sm">{farmer.district?.district_name || 'N/A'}</TableCell>
                                <TableCell className="whitespace-nowrap text-xs md:text-sm">{farmer.mandal?.mandal_name || 'N/A'}</TableCell>
                                <TableCell className="whitespace-nowrap text-xs md:text-sm">{farmer.village || 'N/A'}</TableCell>
                                <TableCell className="whitespace-nowrap text-xs md:text-sm">{farmer.social_media || 'N/A'}</TableCell>
                                <TableCell className="whitespace-nowrap text-xs md:text-sm">{farmer.collected_by?.name || 'N/A'}</TableCell>
                                <TableCell className="whitespace-nowrap text-xs md:text-sm">{farmer.collected_by?.cadre?.name || 'N/A'}</TableCell>
                                <TableCell className="whitespace-nowrap text-xs md:text-sm">{format(new Date(farmer.created_at), 'p')}</TableCell>
                              </TableRow>
                            ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={15} className="text-center">No farmer collections found for the selected criteria.</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="summary">
            <Card>
              <CardContent className="p-6 space-y-4">
                <div className="flex flex-wrap items-center gap-4">
                  {/* Month selector */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        const [year, month] = selectedMonth.split("-").map(Number)
                        const newDate = subMonths(new Date(year, month - 1, 1), 1)
                        setSelectedMonth(`${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, "0")}`)
                      }}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="min-w-[150px] text-center font-medium text-lg">
                      {(() => {
                        const [year, month] = selectedMonth.split("-").map(Number)
                        return format(new Date(year, month - 1, 1), "MMMM yyyy")
                      })()}
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => {
                        const [year, month] = selectedMonth.split("-").map(Number)
                        const newDate = addMonths(new Date(year, month - 1, 1), 1)
                        setSelectedMonth(`${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, "0")}`)
                      }}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* User Type Selector */}
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium">User Type:</label>
                    <Select
                      value={summaryUserType}
                      onValueChange={(value: "employee" | "manager") => setSummaryUserType(value)}
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
                  {summaryUserType === "manager" && (
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium">Manager:</label>
                      <Select
                        value={summarySelectedManagerId}
                        onValueChange={setSummarySelectedManagerId}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Select manager" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Managers</SelectItem>
                          {summaryManagersList.map(manager => (
                            <SelectItem key={manager.id} value={manager.id}>
                              {manager.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Employee Selector for Manager user type */}
                  {summaryUserType === "manager" && summarySelectedManagerId !== "all" && (
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium">Employee:</label>
                      <Select
                        value={summaryEmployeeDropdownTouched ? summarySelectedEmployeeId : ""}
                        onValueChange={(value) => {
                          setSummaryEmployeeDropdownTouched(true)
                          setSummarySelectedEmployeeId(value)
                        }}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Select employee" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Employees</SelectItem>
                          {summaryEmployeesList.map(emp => (
                            <SelectItem key={emp.id} value={emp.id}>
                              {emp.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Employee Selector for Employee user type */}
                  {summaryUserType === "employee" && (
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium">Employee:</label>
                      <Select
                        value={summarySelectedEmployeeId}
                        onValueChange={setSummarySelectedEmployeeId}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Select employee" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Employees</SelectItem>
                          {summaryAllEmployeesList.map(emp => (
                            <SelectItem key={emp.id} value={emp.id}>
                              {emp.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="flex-grow" />

                  {/* Export Button */}
                  <Button
                    onClick={exportSummaryToExcel}
                    disabled={isLoading || attendanceSummaryData.length === 0}
                    className="bg-[#228B22] hover:bg-[#1A6B1A]"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export Excel
                  </Button>
                </div>

                {/* Pagination bar (Gmail style) */}
                <div className="flex items-center justify-end gap-2">
                  {(() => {
                    const total = attendanceSummaryData.length
                    const start = total === 0 ? 0 : summaryPage * PAGE_SIZE + 1
                    const end = Math.min(total, (summaryPage + 1) * PAGE_SIZE)
                    return (
                      <>
                        <span className="text-sm text-muted-foreground">{total === 0 ? '0 of 0' : `${start}-${end} of ${total}`}</span>
                        <Button variant="outline" size="icon" onClick={() => setSummaryPage(p => Math.max(0, p - 1))} disabled={summaryPage === 0}>
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="icon" onClick={() => setSummaryPage(p => p + 1)} disabled={end >= total}>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </>
                    )
                  })()}
                </div>

                {/* Table */}
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-[#228B22]" />
                    <span className="ml-2">Loading attendance summary...</span>
                  </div>
                ) : attendanceSummaryData.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    No attendance data found for the selected criteria.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="whitespace-nowrap sticky left-0 bg-background z-10 font-medium w-[60px]">
                            Sl. No.
                          </TableHead>
                          <TableHead className="whitespace-nowrap sticky left-[60px] bg-background z-10 font-medium min-w-[150px]">
                            Employee Name
                          </TableHead>
                          <TableHead className="whitespace-nowrap text-sm font-medium">
                            Email
                          </TableHead>
                          <TableHead className="whitespace-nowrap text-sm font-medium">
                            Phone
                          </TableHead>
                          <TableHead className="whitespace-nowrap capitalize font-medium">
                            Role
                          </TableHead>
                          <TableHead className="whitespace-nowrap text-sm font-medium">
                            Cadre
                          </TableHead>
                          {daysInMonth.map((date) => {
                            const d = new Date(date)
                            return (
                              <TableHead key={date} className="whitespace-nowrap text-center min-w-[180px] font-medium">
                                <div>{format(d, "dd-MMM")}</div>
                                <div className="text-xs text-muted-foreground">{format(d, "EEE")}</div>
                              </TableHead>
                            )
                          })}
                          <TableHead className="whitespace-nowrap text-center font-medium min-w-[100px]">
                            No. of Present
                          </TableHead>
                          <TableHead className="whitespace-nowrap text-center font-medium min-w-[100px]">
                            No. of Absent
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {attendanceSummaryData
                          .slice(summaryPage * PAGE_SIZE, (summaryPage + 1) * PAGE_SIZE)
                          .map((item, index) => {
                            // Calculate present and absent counts
                            const presentCount = item.dailyAttendance.filter(day => day.attendance === "Present").length
                            const absentCount = item.dailyAttendance.filter(day => day.attendance === "Absent").length

                            return (
                              <TableRow key={item.user.id}>
                                <TableCell className="sticky left-0 bg-background z-10 font-medium w-[60px]">
                                  {summaryPage * PAGE_SIZE + index + 1}
                                </TableCell>
                              <TableCell className="sticky left-[60px] bg-background z-10 font-medium min-w-[150px]">
                                {item.user.name}
                              </TableCell>
                              <TableCell className="whitespace-nowrap text-sm">
                                {item.user.email}
                              </TableCell>
                              <TableCell className="whitespace-nowrap text-sm">
                                {item.user.phone || "-"}
                              </TableCell>
                              <TableCell className="whitespace-nowrap capitalize">
                                {item.user.role}
                              </TableCell>
                              <TableCell className="whitespace-nowrap text-sm">
                                {item.user.cadre?.name || "-"}
                              </TableCell>
                              {item.dailyAttendance.map((day) => (
                                <TableCell key={day.date} className="text-center align-top">
                                  <div className="space-y-1 text-xs md:text-sm">
                                    {day.checkIn ? (
                                      <div className="text-green-700">
                                        In: {formatSummaryTime(day.checkIn)}
                                      </div>
                                    ) : (
                                      <div className="text-gray-400">In: -</div>
                                    )}
                                    {day.checkOut ? (
                                      <div className="text-blue-700">
                                        Out: {formatSummaryTime(day.checkOut)}
                                      </div>
                                    ) : day.checkIn ? (
                                      <div className="text-orange-600">
                                        Out: Not Checked Out
                                      </div>
                                    ) : (
                                      <div className="text-gray-400">Out: -</div>
                                    )}
                                    <div className={day.loginHours >= 9 ? "text-green-700" : "text-orange-600"}>
                                      Hours: {day.loginHours.toFixed(2)}
                                    </div>
                                    <div className={day.attendance === "Present" ? "text-green-700 font-semibold" : "text-red-600 font-semibold"}>
                                      {day.attendance}
                                    </div>
                                  </div>
                                </TableCell>
                              ))}
                              <TableCell className="text-center font-semibold text-green-700 min-w-[100px]">
                                {presentCount}
                              </TableCell>
                              <TableCell className="text-center font-semibold text-red-600 min-w-[100px]">
                                {absentCount}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </TooltipProvider>
  )
}
