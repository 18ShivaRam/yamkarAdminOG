"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, X, User, Activity, Users, LogOut, UserPlus, Home, LayoutDashboard, UserCog, GraduationCap, Wheat, MapPin, Clock, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/contexts/auth-context";
import PasswordChangePopup from "@/components/PasswordChangePopup";
import AvatarUploadPopup from "@/components/AvatarUploadPopup";
import { supabase } from "@/lib/supabaseClient";

type SidebarProps = {
  // userRole: "employee" | "manager" | "admin"; // Commented out as only admin is expected now
  userRole: "admin"; // Only admin role is supported in the web portal
  userName: string;
};

function getInitials(name: string) {
  const nameParts = name.split(" ");
  let initials = "";
  for (let i = 0; i < nameParts.length; i++) {
    initials += nameParts[i].charAt(0).toUpperCase();
  }
  return initials;
}

export default function Sidebar({ userRole, userName }: SidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [showPasswordChangePopup, setShowPasswordChangePopup] = useState(false);
  const [showAvatarUploadPopup, setShowAvatarUploadPopup] = useState(false);
  const [showAvatarPreview, setShowAvatarPreview] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  // const [cadreName, setCadreName] = useState<string | null>(null); // Commented out: cadreName is only for employees
  const pathname = usePathname();
  const router = useRouter();
  const { logout, user } = useAuth();
  
  const toggleSidebar = () => setIsOpen(!isOpen);
  const closeSidebar = () => setIsOpen(false);

  useEffect(() => {
    // Fetch the user's avatar URL
    const fetchUserData = async () => {
      if (user?.id) {
        try {
          const { data, error } = await supabase
            .from('users')
            // .select(`*, cadre(name)`) // Removed cadre selection
            .select('*') // Select all user fields
            .eq('id', user.id)
            .single();

          if (error) {
            console.error("Error fetching user data:", error);
            return;
          }

          if (data) {
            const possibleAvatarFields = ['avatar_url', 'avatarUrl', 'avatar', 'profile_picture', 'profilePicture', 'photo'];
            for (const field of possibleAvatarFields) {
              if (data[field]) {
                setAvatarUrl(data[field]);
                console.log("Found avatar URL in field:", field);
                break;
              }
            }
            
            // Removed cadre name logic as it's only for employees
            // if (data.role === 'employee' && data.cadre) {
            //   setCadreName(data.cadre.name);
            // }
          }
        } catch (err) {
          console.error("Error fetching user data:", err);
        }
      }
    };

    fetchUserData();
  }, [user]);

  // Handle escape key to close mobile sidebar
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  const handleLogout = async () => {
    await logout();
  };

  const handleAvatarClick = () => {
    if (avatarUrl) {
      setShowAvatarPreview(true);
    } else {
      setShowAvatarUploadPopup(true);
    }
  };

  const handlePasswordChange = () => {
    setShowPasswordChangePopup(true);
    closeSidebar();
  };

  const handleAvatarUpdate = (url: string | null) => {
    setAvatarUrl(url);
  };

  /* // Commented out: getDashboardLink is no longer needed as only admin exists
  const getDashboardLink = () => {
    switch (userRole) {
      case "employee":
        return "/employee";
      case "manager":
        return "/manager";
      case "admin":
        return "/admin";
      default:
        return "/";
    }
  };
  */

  /* // Commented out: employeeLinks are not used
  const employeeLinks = [
    { href: getDashboardLink(), label: "Dashboard", icon: Home },
    { href: "/employee/profile", label: "Profile", icon: User },
    { href: "/employee/farmers", label: "Farmer Data", icon: Users },
    { label: "Change Password", icon: Key, onClick: handlePasswordChange },
    { label: "Logout", icon: LogOut, onClick: () => setShowLogoutDialog(true) },
  ];
  */

  /* // Commented out: managerLinks are not used
  const managerLinks = [
    { href: getDashboardLink(), label: "Dashboard", icon: Home },
    { href: "/manager/profile", label: "Profile", icon: User },
    { href: "/manager/employees", label: "Employee Management", icon: Users },
    // { href: "/manager/register", label: "Employee Registration", icon: UserPlus },
    { href: "/manager/reports", label: "Reports", icon: Activity },
    { label: "Change Password", icon: Key, onClick: handlePasswordChange },
    { label: "Logout", icon: LogOut, onClick: () => setShowLogoutDialog(true) },
  ];
  */

  const adminLinks = [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/profile", label: "Personal Information", icon: User },
    { href: "/admin/controls", label: "Admin Controls", icon: Settings },
    { href: "/admin/managers", label: "Manager Management", icon: UserCog },
    { href: "/admin/employees", label: "Employee Management", icon: Users },
    { href: "/admin/password-resets", label: "Password Resets", icon: UserPlus },
    { href: "/admin/approvals", label: "Approvals", icon: Clock },
    { href: "/admin/reports", label: "Reports", icon: Activity },
    { label: "Logout", icon: LogOut, onClick: () => setShowLogoutDialog(true) }
  ];

  /* // Commented out: Simplified link assignment
  const links =
    userRole === "employee"
      ? employeeLinks
      : userRole === "manager"
      ? managerLinks
      : adminLinks;
  */
  const links = adminLinks; // Always use admin links

  return (
    <>
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 bg-white border-b">
        <Button variant="ghost" size="icon" onClick={toggleSidebar} className="text-[#228B22]">
          <Menu className="h-6 w-6" />
        </Button>
        <div className="font-bold text-[#228B22]">Yamkar</div>
        <Avatar className="h-8 w-8 cursor-pointer" onClick={handleAvatarClick}>
          {avatarUrl ? (
            <AvatarImage src={avatarUrl} alt={userName} />
          ) : (
            <AvatarFallback
              // className={`text-white ${
              //   userRole === "admin" ? "bg-[#228B22]" :
              //   userRole === "manager" ? "bg-[#6B8E23]" :
              //   "bg-[#F4A460]"
              // }`}
              className="text-white bg-[#228B22]" // Hardcoded admin color
            >
              {getInitials(userName)}
            </AvatarFallback>
          )}
        </Avatar>
      </div>

      {/* Sidebar - Mobile (Overlay) */}
      <div
        className={cn(
          "fixed inset-0 z-50 bg-black/50 md:hidden transition-opacity",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        <div
          className={cn(
            "fixed inset-y-0 left-0 z-50 w-3/4 max-w-xs bg-white shadow-xl transition-transform duration-300 ease-in-out",
            isOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="flex items-center justify-between p-4 border-b">
            <div className="font-bold text-[#228B22]">Yamkar</div>
            <Button variant="ghost" size="icon" onClick={closeSidebar} className="text-[#228B22]">
              <X className="h-6 w-6" />
            </Button>
          </div>

          <div className="flex flex-col items-center p-4 border-b">
            <Avatar className="h-16 w-16 mb-2 cursor-pointer" onClick={handleAvatarClick}>
              {avatarUrl ? (
                <AvatarImage src={avatarUrl} alt={userName} />
              ) : (
                <AvatarFallback
                  // className={`text-white text-xl ${
                  //   userRole === "admin" ? "bg-[#228B22]" :
                  //   userRole === "manager" ? "bg-[#6B8E23]" :
                  //   "bg-[#F4A460]"
                  // }`}
                  className="text-white text-xl bg-[#228B22]" // Hardcoded admin color
                >
                  {getInitials(userName)}
                </AvatarFallback>
              )}
            </Avatar>
            <div className="text-center">
              <div className="font-medium text-[#228B22]">{userName}</div>
              <div className="text-sm text-[#6B8E23] capitalize">
                Admin {/* Hardcoded role display */}
              </div>
            </div>
          </div>

          <nav className="mt-4 flex-1 px-2 list-none">
            {links.map((link, index) => (
              <li key={link.href || `${link.label}-${index}`}> 
                {link.href ? (
                  <Link
                    href={link.href}
                    prefetch={false}
                    onClick={() => {
                      setIsNavigating(true);
                      closeSidebar();
                    }}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                      pathname === link.href
                        ? "bg-[#F4A460] text-[#228B22] font-medium"
                        : "hover:bg-[#F8F8FF] text-[#333333]"
                    )}
                  >
                    <link.icon className="h-5 w-5" />
                    {link.label}
                  </Link>
                ) : (
                  <Button
                    variant="ghost"
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-[#F8F8FF] transition-colors w-full justify-start",
                      link.label === "Logout" ? "text-[#E2725B]" : "text-[#333333]"
                    )}
                    onClick={link.onClick}
                  >
                    <link.icon className="h-5 w-5" />
                    {link.label}
                  </Button>
                )}
              </li>
            ))}
          </nav>
        </div>
      </div>

      {/* Sidebar - Desktop (Fixed) */}
      <div className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-white border-r">
        <div className="flex items-center justify-center h-16 border-b">
          <div className="font-bold text-xl text-[#228B22]">Yamkar</div>
        </div>

        <div className="flex flex-col items-center p-4 border-b">
          <Avatar className="h-20 w-20 mb-3 cursor-pointer hover:opacity-80 transition-opacity" onClick={handleAvatarClick}>
            {avatarUrl ? (
              <AvatarImage src={avatarUrl} alt={userName} />
            ) : (
              <AvatarFallback
                // className={`text-white text-2xl ${
                //   userRole === "admin" ? "bg-[#228B22]" :
                //   userRole === "manager" ? "bg-[#6B8E23]" :
                //   "bg-[#F4A460]"
                // }`}
                className="text-white text-2xl bg-[#228B22]" // Hardcoded admin color
              >
                {getInitials(userName)}
              </AvatarFallback>
            )}
          </Avatar>
          <div className="text-center">
            <div className="font-medium text-[#228B22]">{userName}</div>
            <div className="text-sm text-[#6B8E23] capitalize">
              Admin {/* Hardcoded role display */}
            </div>
          </div>
        </div>

        <nav className="mt-5 flex-1 px-2 list-none">
          {links.map((link, index) => (
            <li key={link.href || `${link.label}-${index}`}> 
              {link.href ? (
                <Link
                  href={link.href}
                  prefetch={false}
                  onClick={() => setIsNavigating(true)}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                    pathname === link.href
                      ? "bg-[#F4A460] text-[#228B22] font-medium"
                      : "hover:bg-[#F8F8FF] text-[#333333]"
                  )}
                >
                  <link.icon className="h-5 w-5" />
                  {link.label}
                </Link>
              ) : (
                <Button
                  variant="ghost"
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-[#F8F8FF] transition-colors w-full justify-start",
                    link.label === "Logout" ? "text-[#E2725B]" : "text-[#333333]"
                  )}
                  onClick={link.onClick}
                >
                  <link.icon className="h-5 w-5" />
                  {link.label}
                </Button>
              )}
            </li>
          ))}
        </nav>
      </div>

      {/* Logout Confirmation Dialog */}
      <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Logout Confirmation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to logout? Any unsaved work may be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLogout}
              className="bg-[#E2725B] hover:bg-[#D35400] text-white"
            >
              Logout
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Password Change Popup */}
      <PasswordChangePopup
        isOpen={showPasswordChangePopup}
        onClose={() => setShowPasswordChangePopup(false)}
      />

      {/* Avatar Upload Popup */}
      {user && (
        <AvatarUploadPopup
          isOpen={showAvatarUploadPopup}
          onClose={() => setShowAvatarUploadPopup(false)}
          currentAvatar={avatarUrl}
          userId={user.id}
          userName={userName}
          onAvatarUpdate={handleAvatarUpdate}
        />
      )}
      
      {/* Avatar Full-Screen Preview */}
      {showAvatarPreview && avatarUrl && (
        <div 
          className="fixed inset-0 z-[100] bg-black bg-opacity-90 flex items-center justify-center p-4"
          onClick={() => setShowAvatarPreview(false)}
        >
          <div 
            className="relative max-w-4xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <Button 
              variant="secondary" 
              size="icon" 
              className="absolute top-4 right-4 bg-gray-800 text-white hover:bg-gray-700 z-10 rounded-full shadow-md"
              onClick={(e) => {
                e.stopPropagation();
                setShowAvatarPreview(false);
              }}
            >
              <X className="h-6 w-6" />
            </Button>
            <img 
              src={avatarUrl} 
              alt="Profile Picture"
              className="max-h-[90vh] max-w-full h-auto w-auto mx-auto object-contain rounded-md"
            />
          </div>
        </div>
      )}
    </>
  );
}
