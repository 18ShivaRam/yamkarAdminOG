import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from "date-fns";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month"); // Format: YYYY-MM
  const userType = searchParams.get("userType"); // 'employee' or 'manager'
  const selectedManagerId = searchParams.get("selectedManagerId"); // optional
  const selectedEmployeeId = searchParams.get("selectedEmployeeId"); // optional

  if (!month || !userType) {
    return NextResponse.json(
      { error: "Missing required parameters (month and userType)" },
      { status: 400 }
    );
  }

  try {
    // Calculate date range for the selected month
    const [year, monthNum] = month.split("-").map(Number);
    const monthDate = new Date(year, monthNum - 1, 1);
    const start = startOfMonth(monthDate);
    const end = endOfMonth(monthDate);
    const daysInMonth = eachDayOfInterval({ start, end });

    // Step 1: Fetch relevant users based on filters
    let usersQuery = supabase
      .from('users')
      .select('id, name, email, role, manager_id')
      .eq('status', 'approved')
      .eq('is_deleted', false);

    if (userType === 'employee') {
      usersQuery = usersQuery.eq('role', 'employee');
      if (selectedEmployeeId && selectedEmployeeId !== 'all') {
        usersQuery = usersQuery.eq('id', selectedEmployeeId);
      }
    } else if (userType === 'manager') {
      if (selectedManagerId && selectedManagerId !== 'all') {
        if (selectedEmployeeId && selectedEmployeeId !== 'all' && selectedEmployeeId !== '') {
          // Show specific employee under manager
          usersQuery = usersQuery.eq('id', selectedEmployeeId);
        } else if (selectedEmployeeId === 'all') {
          // Show manager + their employees
          usersQuery = usersQuery.or(`id.eq.${selectedManagerId},and(manager_id.eq.${selectedManagerId},role.eq.employee)`);
        } else {
          // Show only the manager
          usersQuery = usersQuery.eq('id', selectedManagerId);
        }
      } else {
        // Show all managers
        usersQuery = usersQuery.eq('role', 'manager');
      }
    }

    const { data: users, error: usersError } = await usersQuery.order('name');
    if (usersError) throw usersError;

    if (!users || users.length === 0) {
      return NextResponse.json({ users: [], daysInMonth: daysInMonth.map(d => format(d, 'yyyy-MM-dd')) });
    }

    const userIds = users.map(u => u.id);

    // Step 2: Fetch attendance logs for these users in the month
    const { data: logs, error: logsError } = await supabase
      .from('attendance_logs')
      .select('id, user_id, check_in, check_out')
      .in('user_id', userIds)
      .gte('check_in', start.toISOString())
      .lte('check_in', end.toISOString())
      .order('check_in', { ascending: true });

    if (logsError) throw logsError;

    // Step 3: Process data for each user and each day
    const result = users.map(user => {
      const userLogs = (logs || []).filter(log => log.user_id === user.id);
      
      const dailyAttendance = daysInMonth.map(day => {
        const dayLogs = userLogs.filter(log => 
          isSameDay(new Date(log.check_in), day)
        );

        let checkIn = null;
        let checkOut = null;

        if (dayLogs.length > 0) {
          // Find earliest check-in
          const sortedByCheckIn = [...dayLogs].sort((a, b) => 
            new Date(a.check_in).getTime() - new Date(b.check_in).getTime()
          );
          checkIn = sortedByCheckIn[0].check_in;

          // Find latest check-out (that is not null)
          const checkOutLogs = dayLogs.filter(log => log.check_out !== null);
          if (checkOutLogs.length > 0) {
            const sortedByCheckOut = [...checkOutLogs].sort((a, b) => 
              new Date(b.check_out!).getTime() - new Date(a.check_out!).getTime()
            );
            checkOut = sortedByCheckOut[0].check_out;
          }
        }

        return {
          date: format(day, 'yyyy-MM-dd'),
          dayOfMonth: day.getDate(),
          checkIn,
          checkOut
        };
      });

      return {
        user,
        dailyAttendance
      };
    });

    return NextResponse.json({
      users: result,
      daysInMonth: daysInMonth.map(d => format(d, 'yyyy-MM-dd'))
    });

  } catch (error) {
    console.error('Error fetching summary report:', error);
    return NextResponse.json(
      { error: "Failed to fetch summary report" },
      { status: 500 }
    );
  }
}
