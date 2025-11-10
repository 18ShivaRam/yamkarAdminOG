"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Users, BarChart, Clock, CheckCircle, XCircle, Loader2 } from "lucide-react"
import Link from "next/link"
import PasswordChangePopup from "@/components/PasswordChangePopup"
import { useAuth } from "@/contexts/auth-context"
import { supabase } from "@/lib/supabaseClient"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/components/ui/use-toast"
import MeterReadingPopup from "@/components/MeterReadingPopup"
import LocationTracker from "@/components/LocationTracker"

export default function ManagerDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showPasswordChangePopup, setShowPasswordChangePopup] = useState(false);
  const [stats, setStats] = useState([
    { label: "Total Employees", value: "0", isLoading: true },
    { label: "Active Today", value: "0", isLoading: true },
    { label: "Data Collections", value: "0", isLoading: true }
  ]);

  // Check-in related states
  const [checkInStatus, setCheckInStatus] = useState<"checked-in" | "checked-out">("checked-out")
  const [lastCheckTime, setLastCheckTime] = useState<string | null>(null)
  const [currentLogId, setCurrentLogId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showMeterPopup, setShowMeterPopup] = useState(false)
  const [meterReadingType, setMeterReadingType] = useState<"check-in" | "check-out">("check-in")

  // Add new state for location tracking
  const [currentLocation, setCurrentLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  // Clear any stuck checkout flags on page load
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Check for stale checkout flag
      const checkoutInProgress = localStorage.getItem('checkout_in_progress');
      if (checkoutInProgress) {
        console.log("Found stale checkout_in_progress flag, clearing it");
        localStorage.removeItem('checkout_in_progress');
      }
      
      // Set up page freeze detection
      let lastActivityTime = Date.now();
      
      const activityHandler = () => {
        lastActivityTime = Date.now();
      };
      
      // Add activity listeners
      ['mousemove', 'keydown', 'click', 'touchstart'].forEach(event => {
        window.addEventListener(event, activityHandler);
      });
      
      // Check for UI freezes every minute
      const freezeDetectionInterval = setInterval(() => {
        const timeSinceLastActivity = Date.now() - lastActivityTime;
        
        // If user is active but UI hasn't responded for over 2 minutes,
        // possibly we have a freeze that needs clearing
        if (timeSinceLastActivity < 60000 && 
            document.visibilityState === 'visible' && 
            checkInStatus === "checked-in") {
          
          // Try to refresh local state
          checkCurrentStatus();
        }
      }, 60000);
      
      return () => {
        // Clean up listeners
        ['mousemove', 'keydown', 'click', 'touchstart'].forEach(event => {
          window.removeEventListener(event, activityHandler);
        });
        
        clearInterval(freezeDetectionInterval);
      };
    }
  }, []);

  useEffect(() => {
    if (user) {
      checkCurrentStatus();
      fetchDashboardStats();
    }
  }, [user]);

  const checkCurrentStatus = async () => {
    if (!user?.id) return;

    try {
      // Get the latest attendance log
      const { data: logData } = await supabase
        .from('attendance_logs')
        .select('*')
        .eq('user_id', user.id)
        .is('check_out', null)
        .single();

      if (logData) {
        setCheckInStatus("checked-in");
        setCurrentLogId(logData.id);
        setLastCheckTime(new Date(logData.check_in).toLocaleTimeString([], { 
          hour: "2-digit", 
          minute: "2-digit" 
        }));
      }
    } catch (error) {
      console.error("Error checking current status:", error);
    }
  };

  const fetchDashboardStats = async () => {
    if (!user) return;

    try {
      // Fetch total employees under this manager
      const { count: employeeCount, error: employeeError } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('manager_id', user.id);

      if (employeeError) throw employeeError;

      // Fetch active employees today (within last 8 hours)
      const { data: activeEmployees, error: activeError } = await supabase
        .from('users')
        .select(`
          id,
          attendance_logs!inner (
            check_in
          )
        `)
        .eq('manager_id', user.id)
        .gte(
          'attendance_logs.check_in',
          new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString()
        );

      if (activeError) throw activeError;

      // Count unique active employees
      const uniqueActiveEmployees = new Set(activeEmployees?.map(emp => emp.id) || []);

      // Fetch data collections count (farmers collected by this manager's team)
      const { data: collectionsData, error: collectionsError } = await supabase
        .from('farmers')
        .select('id, collected_by, users!inner(manager_id)', { count: 'exact' })
        .eq('users.manager_id', user.id);

      if (collectionsError) throw collectionsError;

      setStats([
        { label: "Total Employees", value: employeeCount?.toString() || "0", isLoading: false },
        { label: "Active Today", value: uniqueActiveEmployees.size.toString() || "0", isLoading: false },
        { label: "Data Collections", value: collectionsData?.length?.toString() || "0", isLoading: false }
      ]);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      setStats(prev => prev.map(stat => ({ ...stat, isLoading: false })));
    }
  };

  const initializeCheckIn = () => {
    if (!user?.id || isSubmitting) return;
    setMeterReadingType("check-in");
    setShowMeterPopup(true);
  };

  const initializeCheckOut = () => {
    if (!user?.id || !currentLogId || isSubmitting) return;
    setMeterReadingType("check-out");
    setShowMeterPopup(true);
  };

  const handleCheckIn = async (meterReading: number, imageUrl: string | null, location?: { latitude: number, longitude: number }) => {
    console.log("[DEBUG] handleCheckIn called with:", { meterReading, imageUrl, location });
    if (!user?.id) {
      console.log("[DEBUG] No user ID, returning early");
      return;
    }
    setIsSubmitting(true);
    
    // Set up a timeout to prevent hanging indefinitely
    const timeoutId = setTimeout(() => {
      console.log("[DEBUG] Check-in operation timed out");
      setIsSubmitting(false);
      toast({
        title: "Check-in Timed Out",
        description: "The operation took too long. Please try again.",
        variant: "destructive",
      });
    }, 30000); // 30 seconds timeout

    try {
      // Validate meter reading
      if (typeof meterReading !== 'number' || meterReading < 0) {
        throw new Error("Please enter a valid meter reading");
      }

      console.log("[DEBUG] Starting check-in process with meter reading:", meterReading);
      console.log("[DEBUG] Image URL for check-in:", imageUrl);
      if (location) {
        console.log("[DEBUG] Location data for check-in:", location);
      }
      
      // Create new attendance log
      const { data: logData, error: logError } = await supabase
        .from('attendance_logs')
        .insert([
          { 
            user_id: user.id,
            check_in: new Date().toISOString(),
            check_in_meter_reading: meterReading,
            check_in_meter_image: imageUrl,
            distance_traveled: 0,
            duration_minutes: 0
          }
        ])
        .select()
        .single();

      if (logError) {
        console.error("[DEBUG] Log creation error:", logError);
        throw new Error(`Failed to create attendance log: ${logError.message}`);
      }

      // Save location data if provided
      if (location && location.latitude && location.longitude) {
        try {
          console.log("[DEBUG] Saving initial check-in location data");
          const { error: locationError } = await supabase
            .from('employee_locations')
            .insert([
              { 
                user_id: user.id,
                attendance_log_id: logData.id,
                latitude: location.latitude,
                longitude: location.longitude,
                captured_at: new Date().toISOString()
              }
            ]);

          if (locationError) {
            console.error("[DEBUG] Error saving location data:", locationError);
            toast({
              title: "Location Warning",
              description: "Check-in successful but location data could not be saved.",
              variant: "warning",
            });
          } else {
            console.log("[DEBUG] Location data saved successfully");
            
            // Set location tracking flag to avoid duplicate location capture
            if (typeof window !== 'undefined') {
              localStorage.setItem('initial_location_captured', 'true');
              
              // Remove the flag after 30 seconds to allow normal tracking to resume
              setTimeout(() => {
                console.log("[DEBUG] Removing initial_location_captured flag to resume normal tracking");
                localStorage.removeItem('initial_location_captured');
              }, 30000);
            }
          }
        } catch (locationError) {
          console.error("[DEBUG] Exception saving location data:", locationError);
        }
      }

      // Update user's active status
      const { error: userError } = await supabase
        .from('users')
        .update({ is_active: true })
        .eq('id', user.id);

      if (userError) {
        console.error("[DEBUG] Error updating user status:", userError);
      }

      setCheckInStatus("checked-in");
      setCurrentLogId(logData.id);
      setLastCheckTime(new Date().toLocaleTimeString([], { 
        hour: "2-digit", 
        minute: "2-digit" 
      }));

      clearTimeout(timeoutId);
      toast({
        title: "Checked In Successfully",
        description: "Your attendance and meter reading have been recorded.",
      });
    } catch (error: any) {
      console.error('[DEBUG] Error during check-in:', error);
      toast({
        title: "Check-in Failed",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      clearTimeout(timeoutId);
      setIsSubmitting(false);
      setShowMeterPopup(false);
    }
  };

  const calculateDuration = (checkInTime: string): number => {
    const checkIn = new Date(checkInTime);
    const checkOut = new Date();
    const durationMs = checkOut.getTime() - checkIn.getTime();
    const durationMinutes = Math.round(durationMs / (1000 * 60));
    return Math.max(1, durationMinutes); // Ensure at least 1 minute
  };

  const calculateDistance = (checkInReading: number, checkOutReading: number): number => {
    return Math.max(0, checkOutReading - checkInReading);
  };

  const handleCheckOut = async (meterReading: number, imageUrl: string | null, location?: { latitude: number, longitude: number }) => {
    console.log("[DEBUG] handleCheckOut called with:", { meterReading, imageUrl, location });
    
    // Verify we have the required data
    if (!user?.id) {
      console.error("[DEBUG] No user ID found for checkout");
      toast({
        title: "Checkout Failed",
        description: "User information is missing. Please try logging in again.",
        variant: "destructive",
      });
      return;
    }
    
    if (!currentLogId) {
      console.error("[DEBUG] No active check-in found (no currentLogId)");
      toast({
        title: "Checkout Failed",
        description: "No active check-in found. You may have already checked out.",
        variant: "destructive",
      });
      return;
    }
    
    // Prevent multiple submissions
    if (isSubmitting) {
      console.log("[DEBUG] Already processing a checkout request");
      return;
    }
    
    setIsSubmitting(true);
    
    // Set a flag to prevent the location tracker from running during checkout
    if (typeof window !== 'undefined') {
      localStorage.setItem('checkout_in_progress', 'true');
    }
    
    // Ensure flag is cleared after a maximum time to prevent stuck state
    const maxCheckoutTime = setTimeout(() => {
      console.log("[DEBUG] Maximum checkout time reached, clearing flag");
      if (typeof window !== 'undefined') {
        localStorage.removeItem('checkout_in_progress');
      }
    }, 120000); // 2 minutes absolute maximum
    
    // Set up a timeout to prevent hanging indefinitely
    const timeoutId = setTimeout(() => {
      console.log("[DEBUG] Check-out operation timed out");
      setIsSubmitting(false);
      setShowMeterPopup(false);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('checkout_in_progress');
      }
      toast({
        title: "Check-out Timed Out",
        description: "The operation took too long. Please try again.",
        variant: "destructive",
      });
    }, 30000);

    try {
      // Validate meter reading
      if (typeof meterReading !== 'number' || meterReading < 0) {
        throw new Error("Please enter a valid meter reading");
      }

      // Get the check-in data to calculate duration and distance
      const { data: checkInData, error: checkInError } = await supabase
        .from('attendance_logs')
        .select('check_in, check_in_meter_reading')
        .eq('id', currentLogId)
        .single();

      if (checkInError) throw checkInError;

      const checkOutTime = new Date();
      const durationMinutes = calculateDuration(checkInData.check_in);
      const distanceTraveled = calculateDistance(checkInData.check_in_meter_reading, meterReading);

      // Update attendance log
      const { error: updateError } = await supabase
        .from('attendance_logs')
        .update({
          check_out: checkOutTime.toISOString(),
          check_out_meter_reading: meterReading,
          check_out_meter_image: imageUrl,
          duration_minutes: durationMinutes,
          distance_traveled: distanceTraveled
        })
        .eq('id', currentLogId);

      if (updateError) throw updateError;

      // Save location data if provided
      if (location && location.latitude && location.longitude) {
        const { error: locationError } = await supabase
          .from('employee_locations')
          .insert([
            { 
              user_id: user.id,
              attendance_log_id: currentLogId,
              latitude: location.latitude,
              longitude: location.longitude,
              captured_at: new Date().toISOString()
            }
          ]);

        if (locationError) {
          console.error("Error saving location:", locationError);
          toast({
            title: "Location Warning",
            description: "Check-out successful but location data could not be saved.",
            variant: "warning",
          });
        }
      }

      // Update user's active status
      const { error: userError } = await supabase
        .from('users')
        .update({ is_active: false })
        .eq('id', user.id);

      if (userError) {
        console.error("Error updating user status:", userError);
      }

      // Update daily work summary
      try {
        const today = new Date().toISOString().split('T')[0];
        const { error: summaryError } = await supabase
          .from('daily_work_summary')
          .upsert({
            user_id: user.id,
            date: today,
            total_working_hours: durationMinutes / 60,
            total_distance_traveled: distanceTraveled,
            last_check_out: checkOutTime.toISOString()
          });

        if (summaryError) {
          console.error("Error updating daily summary:", summaryError);
        }
      } catch (summaryError) {
        console.error("Error in daily summary update:", summaryError);
      }

      setCheckInStatus("checked-out");
      setCurrentLogId(null);
      setLastCheckTime(null);

      toast({
        title: "Checked Out Successfully",
        description: `Your attendance has been recorded. Distance traveled: ${distanceTraveled} km`,
      });

      // Refresh dashboard stats after check-out
      fetchDashboardStats();
    } catch (error: any) {
      console.error("[DEBUG] Checkout error:", error);
      toast({
        title: "Check-out Failed",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      clearTimeout(timeoutId);
      clearTimeout(maxCheckoutTime);
      setIsSubmitting(false);
      setShowMeterPopup(false);
      
      // Remove the checkout flag
      if (typeof window !== 'undefined') {
        localStorage.removeItem('checkout_in_progress');
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Include the LocationTracker when manager is checked in */}
      {checkInStatus === "checked-in" && currentLogId && (
        <LocationTracker 
          attendanceLogId={currentLogId} 
          interval={120000} // 2 minutes in milliseconds
        />
      )}

      <div>
        <h1 className="text-2xl font-bold text-[#228B22]">Manager Dashboard</h1>
        <p className="text-[#6B8E23]">Welcome back{user?.name ? `, ${user.name}` : ''}</p>
      </div>

      {/* Check-in/Check-out Card */}
      <Card className="bg-gradient-to-r from-[#F4A460] to-[#6B8E23] bg-opacity-10">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-white bg-opacity-90 flex items-center justify-center">
                <Clock className="h-6 w-6 text-[#228B22]" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white mb-1">Current Status</h2>
                {lastCheckTime && (
                  <div className="text-sm text-white flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    {checkInStatus === "checked-in" ? `Checked in at ${lastCheckTime}` : `Last checked out at ${lastCheckTime}`}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4">
              {checkInStatus === "checked-out" ? (
                <Button 
                  onClick={initializeCheckIn} 
                  disabled={isSubmitting} 
                  className="w-full md:w-auto bg-[#228B22] hover:bg-[#1A6B1A]"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Check In
                    </>
                  )}
                </Button>
              ) : (
                <Button 
                  onClick={initializeCheckOut} 
                  disabled={isSubmitting} 
                  className="w-full md:w-auto bg-red-500 hover:bg-red-600"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4 mr-2" />
                      Check Out
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map((stat, index) => (
          <Card key={index}>
            <CardContent className="p-4">
              <div className="text-sm text-muted-foreground">{stat.label}</div>
              {stat.isLoading ? (
                <Skeleton className="h-8 w-16 mt-1" />
              ) : (
              <div className="text-2xl font-bold text-[#228B22]">{stat.value}</div>
              )}
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
                <Link href="/manager/employees">View Employees</Link>
              </Button>
            </div>
            <h2 className="text-lg font-semibold mb-2">Employee Management</h2>
            <p className="text-sm text-muted-foreground">View and manage your team</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="h-12 w-12 rounded-full bg-[#228B22] bg-opacity-10 flex items-center justify-center">
                <BarChart className="h-6 w-6 text-[#228B22]" />
              </div>
              <Button variant="ghost" className="text-[#6B8E23]" asChild>
                <Link href="/manager/reports">View Reports</Link>
              </Button>
            </div>
            <h2 className="text-lg font-semibold mb-2">Performance Reports</h2>
            <p className="text-sm text-muted-foreground">View team performance and activity reports</p>
          </CardContent>
        </Card>
      </div>

      {/* Meter Reading Popup */}
      {user && showMeterPopup && (
        <MeterReadingPopup
          isOpen={showMeterPopup}
          onClose={() => setShowMeterPopup(false)}
          onSubmit={meterReadingType === "check-in" ? handleCheckIn : handleCheckOut}
          type={meterReadingType}
          userId={user.id}
        />
      )}

      {/* Password Change Popup */}
      <PasswordChangePopup
        isOpen={showPasswordChangePopup}
        onClose={() => setShowPasswordChangePopup(false)}
      />
    </div>
  )
}

