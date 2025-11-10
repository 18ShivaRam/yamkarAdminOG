"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { format, startOfMonth, endOfMonth } from "date-fns"
import { useAuth } from "@/contexts/auth-context"
import { supabase } from "@/lib/supabaseClient"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/components/ui/use-toast"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Calendar as CalendarIcon, Download, Eye, Loader2 } from "lucide-react"
import Image from "next/image"

interface AttendanceRecord {
  id: string
  user_id: string
  check_in: string
  check_out: string | null
  check_in_meter_reading: number
  check_out_meter_reading: number | null
  check_in_meter_image: string | null
  check_out_meter_image: string | null
  distance_traveled: number
  duration_minutes: number
  user: {
    name: string
    phone: string
    email: string
    cadre: {
      name: string
    }
    state: {
      state_name: string
    }
    district: {
      district_name: string
    }
    mandal: {
      mandal_name: string
    }
  }
}

interface FarmerCollection {
  id: string
  created_at: string
  collected_by: string
  name: string
  mobile_number: string
  email: string
  crop: {
    name: string
  }
  company: {
    name: string
  }
  state: {
    state_name: string
  }
  district: {
    district_name: string
  }
  mandal: {
    mandal_name: string
  }
  village: {
    name: string
  }
  social_media: string | null
  user: {
    name: string
  }
}

export default function ManagerReports() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [fromDate, setFromDate] = useState<Date>(startOfMonth(new Date()))
  const [toDate, setToDate] = useState<Date>(endOfMonth(new Date()))
  const [isLoading, setIsLoading] = useState(true)
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([])
  const [farmerCollections, setFarmerCollections] = useState<FarmerCollection[]>([])
  const [showImageDialog, setShowImageDialog] = useState(false)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("attendance")
  const [isExporting, setIsExporting] = useState(false)

  useEffect(() => {
    if (user) {
      fetchReports()
    }
  }, [user, fromDate, toDate])

  const fetchReports = async () => {
    if (!user?.id) return
    setIsLoading(true)

    try {
      // Set time to start and end of day for the respective dates
      const startDate = new Date(fromDate)
      startDate.setHours(0, 0, 0, 0)
      const endDate = new Date(toDate)
      endDate.setHours(23, 59, 59, 999)

      // Fetch attendance records with user details
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendance_logs')
        .select(`
          *,
          user:users(
            name,
            phone,
            email,
            cadre:cadres(name),
            state:states(state_name),
            district:districts(district_name),
            mandal:mandals(mandal_name)
          )
        `)
        .eq('users.manager_id', user.id)
        .gte('check_in', startDate.toISOString())
        .lte('check_in', endDate.toISOString())
        .order('check_in', { ascending: false })

      if (attendanceError) throw attendanceError

      // Fetch farmer collections with all details
      const { data: collectionsData, error: collectionsError } = await supabase
        .from('farmers')
        .select(`
          id,
          created_at,
          collected_by,
          name,
          mobile_number,
          email,
          crop:crops(name),
          company:companies(name),
          state:states(state_name),
          district:districts(district_name),
          mandal:mandals(mandal_name),
          village:villages(name),
          social_media,
          user:users!collected_by(name)
        `)
        .eq('users.manager_id', user.id)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: false })

      if (collectionsError) throw collectionsError

      // Filter out any entries where user is null and map to include safe defaults
      const safeCollectionsData = (collectionsData || []).map(collection => ({
        ...collection,
        user: collection.user || { name: 'Unknown Employee' }
      }))

      setAttendanceRecords(attendanceData || [])
      setFarmerCollections(safeCollectionsData)
    } catch (error) {
      console.error('Error fetching reports:', error)
      toast({
        title: "Error",
        description: "Failed to fetch reports. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleImageClick = (imageUrl: string) => {
    setSelectedImage(imageUrl)
    setShowImageDialog(true)
  }

  const exportToCSV = async () => {
    setIsExporting(true)
    try {
      const csvData = activeTab === "attendance" 
        ? attendanceRecords.map(record => ({
            "Employee Name": record.user?.name || 'Unknown',
            "Phone": record.user?.phone || 'N/A',
            "Email": record.user?.email || 'N/A',
            "Cadre": record.user?.cadre?.name || 'N/A',
            "State": record.user?.state?.state_name || 'N/A',
            "District": record.user?.district?.district_name || 'N/A',
            "Mandal": record.user?.mandal?.mandal_name || 'N/A',
            "Check In Date": format(new Date(record.check_in), "dd-MM-yyyy"),
            "Check In Time": format(new Date(record.check_in), "hh:mm:ss aa"),
            "Check In Reading": record.check_in_meter_reading,
            "Check In Odometer Image": record.check_in_meter_image || "N/A",
            "Check Out Date": record.check_out ? format(new Date(record.check_out), "dd-MM-yyyy") : "Not checked out",
            "Check Out Time": record.check_out ? format(new Date(record.check_out), "hh:mm:ss aa") : "Not checked out",
            "Check Out Reading": record.check_out_meter_reading || "N/A",
            "Check Out Odometer Image": record.check_out_meter_image || "N/A",
            "Distance Traveled (km)": record.distance_traveled,
            "Duration (minutes)": record.duration_minutes
          }))
        : farmerCollections.map(collection => ({
            "Employee Name": collection.user?.name || 'Unknown',
            "Collection Date": format(new Date(collection.created_at), "dd-MM-yyyy"),
            "Collection Time": format(new Date(collection.created_at), "hh:mm:ss aa"),
            "Farmer Name": collection.name || 'N/A',
            "Mobile Number": collection.mobile_number || 'N/A',
            "Email": collection.email || 'N/A',
            "Crop": collection.crop?.name || 'N/A',
            "Company": collection.company?.name || 'N/A',
            "State": collection.state?.state_name || 'N/A',
            "District": collection.district?.district_name || 'N/A',
            "Mandal": collection.mandal?.mandal_name || 'N/A',
            "Village": collection.village?.name || 'N/A',
            "Social Media": collection.social_media || 'N/A'
          }))

      if (csvData.length === 0) {
        toast({
          title: "No Data",
          description: "There is no data to export for the selected date.",
          variant: "warning",
        })
        return
      }

      const headers = Object.keys(csvData[0])
      const rows = csvData.map(row => 
        Object.values(row).map(value => {
          // Convert value to string and check if it needs quotes
          const stringValue = String(value)
          return stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')
            ? `"${stringValue.replace(/"/g, '""')}"` // Escape quotes and wrap in quotes
            : stringValue
        }).join(',')
      )
      
      const csv = [headers.join(','), ...rows].join('\n')

      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${activeTab}_report_${format(fromDate, 'dd-MM-yyyy')}_to_${format(toDate, 'dd-MM-yyyy')}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast({
        title: "Success",
        description: "Report exported successfully",
      })
    } catch (error) {
      console.error('Error exporting data:', error)
      toast({
        title: "Error",
        description: "Failed to export report",
        variant: "destructive",
      })
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="w-full md:w-auto">
          <h1 className="text-xl md:text-2xl font-bold text-[#228B22] mb-1">Reports</h1>
          <p className="text-sm md:text-base text-[#6B8E23]">View team performance and activity reports</p>
        </div>

        <div className="flex flex-col w-full md:w-auto sm:flex-row items-start md:items-center gap-3 md:gap-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full sm:w-auto">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full sm:w-[180px] md:w-[200px] justify-start text-left font-normal text-sm md:text-base"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(fromDate, "MMM dd, yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={fromDate}
                  onSelect={(date) => date && setFromDate(date)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <span className="hidden sm:inline text-muted-foreground">to</span>
          <Popover>
            <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full sm:w-[180px] md:w-[200px] justify-start text-left font-normal text-sm md:text-base"
                >
                <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(toDate, "MMM dd, yyyy")}
              </Button>
            </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={toDate}
                  onSelect={(date) => date && setToDate(date)}
                  initialFocus
                />
            </PopoverContent>
          </Popover>
          </div>
          
          <Button
            onClick={exportToCSV}
            disabled={isExporting || isLoading}
            className="w-full sm:w-auto bg-[#228B22] hover:bg-[#1A6B1A] text-sm md:text-base"
          >
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
            Export
              </>
            )}
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-2">
          <TabsTrigger value="attendance" className="text-sm md:text-base">Attendance Records</TabsTrigger>
          <TabsTrigger value="collections" className="text-sm md:text-base">Farmer Collections</TabsTrigger>
        </TabsList>

        <TabsContent value="attendance">
          <Card className="border-0 md:border">
            <CardHeader className="px-2 md:px-6 py-4">
              <CardTitle className="text-base md:text-lg font-semibold">
                Attendance Records - {format(fromDate, "MMM dd")} to {format(toDate, "MMM dd, yyyy")}
              </CardTitle>
          </CardHeader>
            <CardContent className="px-0 md:px-6">
              {isLoading ? (
                <div className="space-y-4 px-2 md:px-0">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  </div>
              ) : attendanceRecords.length > 0 ? (
                <div className="overflow-x-auto -mx-2 md:mx-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="whitespace-nowrap text-xs md:text-sm font-medium">Employee</TableHead>
                        <TableHead className="whitespace-nowrap text-xs md:text-sm font-medium">Email</TableHead>
                        <TableHead className="whitespace-nowrap text-xs md:text-sm font-medium">Cadre</TableHead>
                        <TableHead className="whitespace-nowrap text-xs md:text-sm font-medium">State</TableHead>
                        <TableHead className="whitespace-nowrap text-xs md:text-sm font-medium">District</TableHead>
                        <TableHead className="whitespace-nowrap text-xs md:text-sm font-medium">Mandal</TableHead>
                        <TableHead className="whitespace-nowrap text-xs md:text-sm font-medium">Check In Date</TableHead>
                        <TableHead className="whitespace-nowrap text-xs md:text-sm font-medium">Check In Time</TableHead>
                        <TableHead className="whitespace-nowrap text-xs md:text-sm font-medium">Check In Reading</TableHead>
                        <TableHead className="whitespace-nowrap text-xs md:text-sm font-medium">Check In Odometer Image</TableHead>
                        <TableHead className="whitespace-nowrap text-xs md:text-sm font-medium">Check Out Date</TableHead>
                        <TableHead className="whitespace-nowrap text-xs md:text-sm font-medium">Check Out Time</TableHead>
                        <TableHead className="whitespace-nowrap text-xs md:text-sm font-medium">Check Out Reading</TableHead>
                        <TableHead className="whitespace-nowrap text-xs md:text-sm font-medium">Check Out Odometer Image</TableHead>
                        <TableHead className="whitespace-nowrap text-xs md:text-sm font-medium">Distance (km)</TableHead>
                        <TableHead className="whitespace-nowrap text-xs md:text-sm font-medium">Duration (min)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {attendanceRecords.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell className="text-xs md:text-sm">
                            <div>
                              <div className="font-medium">{record.user?.name || 'Unknown'}</div>
                              <div className="text-xs text-muted-foreground">{record.user?.phone || 'N/A'}</div>
                    </div>
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-xs md:text-sm">{record.user?.email || 'N/A'}</TableCell>
                          <TableCell className="whitespace-nowrap text-xs md:text-sm">{record.user?.cadre?.name || 'N/A'}</TableCell>
                          <TableCell className="whitespace-nowrap text-xs md:text-sm">{record.user?.state?.state_name || 'N/A'}</TableCell>
                          <TableCell className="whitespace-nowrap text-xs md:text-sm">{record.user?.district?.district_name || 'N/A'}</TableCell>
                          <TableCell className="whitespace-nowrap text-xs md:text-sm">{record.user?.mandal?.mandal_name || 'N/A'}</TableCell>
                          <TableCell className="whitespace-nowrap text-xs md:text-sm">{format(new Date(record.check_in), "MMM dd, yyyy")}</TableCell>
                          <TableCell className="whitespace-nowrap text-xs md:text-sm">{format(new Date(record.check_in), "hh:mm:ss aa")}</TableCell>
                          <TableCell className="whitespace-nowrap text-xs md:text-sm">{record.check_in_meter_reading}</TableCell>
                          <TableCell className="whitespace-nowrap text-xs md:text-sm">
                            {record.check_in_meter_image ? (
                              <a 
                                href={record.check_in_meter_image} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-[#228B22] hover:underline"
                              >
                                View Image
                              </a>
                            ) : "N/A"}
                          </TableCell>
                          <TableCell className="text-xs md:text-sm">
                            {record.check_out 
                              ? format(new Date(record.check_out), "MMM dd, yyyy")
                              : "Not checked out"}
                          </TableCell>
                          <TableCell className="text-xs md:text-sm">
                            {record.check_out 
                              ? format(new Date(record.check_out), "hh:mm:ss aa")
                              : "Not checked out"}
                          </TableCell>
                          <TableCell className="text-xs md:text-sm">{record.check_out_meter_reading || "N/A"}</TableCell>
                          <TableCell className="text-xs md:text-sm">
                            {record.check_out_meter_image ? (
                              <a 
                                href={record.check_out_meter_image} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-[#228B22] hover:underline"
                              >
                                View Image
                              </a>
                            ) : "N/A"}
                          </TableCell>
                          <TableCell className="text-xs md:text-sm">{record.distance_traveled}</TableCell>
                          <TableCell className="text-xs md:text-sm">{record.duration_minutes}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground text-sm md:text-base">
                  No attendance records found for this date range
            </div>
              )}
          </CardContent>
        </Card>
        </TabsContent>

        <TabsContent value="collections">
          <Card className="border-0 md:border">
            <CardHeader className="px-2 md:px-6 py-4">
              <CardTitle className="text-base md:text-lg font-semibold">
                Farmer Collections - {format(fromDate, "MMM dd")} to {format(toDate, "MMM dd, yyyy")}
              </CardTitle>
          </CardHeader>
            <CardContent className="px-0 md:px-6">
              {isLoading ? (
                <div className="space-y-4 px-2 md:px-0">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  </div>
              ) : farmerCollections.length > 0 ? (
                <div className="overflow-x-auto -mx-2 md:mx-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs md:text-sm font-medium">Employee Name</TableHead>
                        <TableHead className="text-xs md:text-sm font-medium">Collection Date</TableHead>
                        <TableHead className="text-xs md:text-sm font-medium">Collection Time</TableHead>
                        <TableHead className="text-xs md:text-sm font-medium">Farmer Name</TableHead>
                        <TableHead className="text-xs md:text-sm font-medium">Mobile Number</TableHead>
                        <TableHead className="text-xs md:text-sm font-medium">Email</TableHead>
                        <TableHead className="text-xs md:text-sm font-medium">Crop</TableHead>
                        <TableHead className="text-xs md:text-sm font-medium">Company</TableHead>
                        <TableHead className="text-xs md:text-sm font-medium">State</TableHead>
                        <TableHead className="text-xs md:text-sm font-medium">District</TableHead>
                        <TableHead className="text-xs md:text-sm font-medium">Mandal</TableHead>
                        <TableHead className="text-xs md:text-sm font-medium">Village</TableHead>
                        <TableHead className="text-xs md:text-sm font-medium">Social Media</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {farmerCollections.map((collection) => (
                        <TableRow key={collection.id}>
                          <TableCell className="text-xs md:text-sm">{collection.user?.name || 'Unknown'}</TableCell>
                          <TableCell className="text-xs md:text-sm">{format(new Date(collection.created_at), "MMM dd, yyyy")}</TableCell>
                          <TableCell className="text-xs md:text-sm">{format(new Date(collection.created_at), "hh:mm:ss aa")}</TableCell>
                          <TableCell className="text-xs md:text-sm">{collection.name || 'N/A'}</TableCell>
                          <TableCell className="text-xs md:text-sm">{collection.mobile_number || 'N/A'}</TableCell>
                          <TableCell className="text-xs md:text-sm">{collection.email || 'N/A'}</TableCell>
                          <TableCell className="text-xs md:text-sm">{collection.crop?.name || 'N/A'}</TableCell>
                          <TableCell className="text-xs md:text-sm">{collection.company?.name || 'N/A'}</TableCell>
                          <TableCell className="text-xs md:text-sm">{collection.state?.state_name || 'N/A'}</TableCell>
                          <TableCell className="text-xs md:text-sm">{collection.district?.district_name || 'N/A'}</TableCell>
                          <TableCell className="text-xs md:text-sm">{collection.mandal?.mandal_name || 'N/A'}</TableCell>
                          <TableCell className="text-xs md:text-sm">{collection.village?.name || 'N/A'}</TableCell>
                          <TableCell className="text-xs md:text-sm">{collection.social_media || 'N/A'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground text-sm md:text-base">
                  No farmer collections found for this date range
            </div>
              )}
          </CardContent>
        </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showImageDialog} onOpenChange={setShowImageDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Meter Reading Image</DialogTitle>
          </DialogHeader>
          {selectedImage && (
            <div className="relative aspect-video">
              <Image
                src={selectedImage}
                alt="Meter Reading"
                fill
                className="object-contain"
              />
      </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

