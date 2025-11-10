"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { User, Mail, Phone, ShieldCheck, Calendar, Camera, Loader2, X, Edit, Save, X as XIcon } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { useAuth } from "@/contexts/auth-context"
import { supabase } from "@/lib/supabaseClient"
import AvatarUploadPopup from "@/components/AvatarUploadPopup"
import PasswordChangePopup from "@/components/PasswordChangePopup"
import { Separator } from "@/components/ui/separator"
import { useRouter } from "next/navigation"

export default function AdminProfilePage() {
  const { toast } = useToast()
  const { user, isLoading: authLoading } = useAuth()
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [showAvatarUploadPopup, setShowAvatarUploadPopup] = useState(false)
  const [showFullScreenPreview, setShowFullScreenPreview] = useState(false)
  const [showPasswordPopup, setShowPasswordPopup] = useState(false)
  
  const [profileData, setProfileData] = useState({
    name: "",
    email: "",
    phone: "",
    role: "admin",
    joinDate: "",
  })

  const [editForm, setEditForm] = useState({ ...profileData })

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
    }
  }, [user, authLoading, router])

  useEffect(() => {
    if (!user) return;
    
    const fetchUserProfile = async () => {
      
      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .single();
          
        if (error) {
          throw new Error(error.message || 'Failed to fetch user profile');
        }
        
        if (data) {
          // Also fetch auth user to get join date from auth.users
          const { data: authUserData, error: authErr } = await supabase.auth.getUser();
          if (authErr) {
            console.warn('Failed to get auth user for join date:', authErr);
          }
          // Set profile data
          setProfileData({
            name: data.name || "",
            email: data.email || "",
            phone: data.phone || data.phone_number || "",
            role: "admin",
            joinDate: authUserData?.user?.created_at ? new Date(authUserData.user.created_at).toLocaleDateString() : "",
          });
          
          setEditForm({
            name: data.name || "",
            email: data.email || "",
            phone: data.phone || data.phone_number || "",
            role: "admin",
            joinDate: authUserData?.user?.created_at ? new Date(authUserData.user.created_at).toLocaleDateString() : "",
          });
          
          // Look for avatar URL
          const possibleAvatarFields = ['avatar_url', 'avatarUrl', 'avatar', 'profile_picture', 'profilePicture', 'photo'];
          for (const field of possibleAvatarFields) {
            if (data[field]) {
              setAvatarUrl(data[field]);
              break;
            }
          }
        }
      } catch (error: any) {
        console.error("Error fetching profile:", error);
        toast({
          title: "Error",
          description: error?.message || "Failed to load profile data",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchUserProfile();
  }, [user, toast]);

  const handleSave = async () => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      
      const { error } = await supabase
        .from('users')
        .update({
          name: editForm.name,
          // Removed phone number update to restrict editing to only the name
        })
        .eq('id', user.id);
        
      if (error) throw error;
      
      // Only update the name in the profile data
      setProfileData({
        ...profileData,
        name: editForm.name
      });
      setIsEditing(false);
      
      toast({
        title: "Profile Updated",
        description: "Your profile has been successfully updated.",
        duration: 3000,
      });
    } catch (error: any) {
      console.error("Error updating profile:", error);
      toast({
        title: "Error",
        description: "Failed to update profile",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAvatarUpdate = (url: string | null) => {
    setAvatarUrl(url);
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-[#228B22]" />
          <p className="text-[#228B22]">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="text-center">
          <p className="text-red-500">You need to be logged in to view this page.</p>
          <Button 
            onClick={() => router.push('/login')}
            className="mt-4"
          >
            Go to Login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#228B22]">Admin Profile</h1>
            <p className="text-sm text-muted-foreground">View and manage your account details</p>
          </div>
          
          <div className="flex gap-2">
            {!isEditing ? (
              <Button 
                onClick={() => setIsEditing(true)} 
                variant="outline"
                className="gap-2"
              >
                <Edit className="h-4 w-4" />
                <span className="hidden sm:inline">Edit Profile</span>
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setIsEditing(false);
                    // Reset form to original data
                    setEditForm({
                      ...profileData,
                      email: profileData.email,
                      phone: profileData.phone,
                    });
                  }}
                  disabled={isLoading}
                >
                  <XIcon className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">Cancel</span>
                </Button>
                <Button 
                  onClick={handleSave} 
                  disabled={isLoading}
                  className="gap-1"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-1" />
                  )}
                  <span className="hidden sm:inline">Save Changes</span>
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Profile Card */}
          <Card className="lg:col-span-1">
            <CardContent className="pt-6 flex flex-col items-center">
              <div className="relative group">
                <Avatar 
                  className="h-32 w-32 mb-4 cursor-pointer border-4 border-[#228B22]/20 hover:border-[#228B22]/40 transition-colors"
                  onClick={() => avatarUrl && setShowFullScreenPreview(true)}
                >
                  {avatarUrl ? (
                    <AvatarImage src={avatarUrl} alt={profileData.name} className="object-cover" />
                  ) : (
                    <AvatarFallback className="bg-[#228B22] text-white text-3xl font-medium">
                      {getInitials(profileData.name)}
                    </AvatarFallback>
                  )}
                </Avatar>
                {/** Change Photo temporarily disabled */}
              </div>
              <h2 className="text-xl font-semibold text-center mt-2">
                {isEditing ? (
                  <Input 
                    value={editForm.name}
                    onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                    className="text-center font-semibold text-lg h-9"
                  />
                ) : (
                  profileData.name
                )}
              </h2>
              <Badge variant="outline" className="mt-3 bg-[#228B22]/10 text-[#228B22] border-[#228B22]/20 text-xs py-1 px-2.5">
                <ShieldCheck className="h-3 w-3 mr-1.5" />
                {profileData.role.charAt(0).toUpperCase() + profileData.role.slice(1)}
              </Badge>
              <p className="text-xs text-muted-foreground mt-3 flex items-center bg-muted/30 px-3 py-1.5 rounded-full">
                <Calendar className="h-3 w-3 mr-1.5 flex-shrink-0" />
                <span>Member since {profileData.joinDate}</span>
              </p>
            </CardContent>
          </Card>
          
          {/* Edit Profile Card */}
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle className="text-xl">Profile Information</CardTitle>
              <CardDescription className="text-sm">
                Manage your account details and personal information
              </CardDescription>
            </CardHeader>
            <Separator className="mb-6" />
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground">BASIC INFORMATION</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-sm font-medium">Full Name</Label>
                    {isEditing ? (
                      <Input 
                        id="name" 
                        value={editForm.name}
                        onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                        className="h-10"
                      />
                    ) : (
                      <div className="flex items-center h-10 px-3 py-2 rounded-md border bg-muted/50">
                        <span className="text-sm">{profileData.name}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm font-medium">Email Address</Label>
                    {isEditing ? (
                      <Input 
                        id="email"
                        type="email"
                        value={editForm.email}
                        onChange={(e) => setEditForm({...editForm, email: e.target.value})}
                        className="h-10"
                      />
                    ) : (
                      <div className="flex items-center h-10 px-3 py-2 rounded-md border bg-muted/50">
                        <span className="text-sm">{profileData.email}</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-sm font-medium flex items-center">
                      <Phone className="h-3.5 w-3.5 mr-1.5" />
                      <span>Phone Number</span>
                    </Label>
                    <div className="flex items-center h-10 px-3 py-2 rounded-md border bg-muted/20">
                      <span className="text-sm">{profileData.phone || 'Not provided'}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Contact support to update your phone number
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center">
                      <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />
                      <span>Account Type</span>
                    </Label>
                    <div className="flex items-center h-10 px-3 py-2 rounded-md border bg-muted/20">
                      <Badge variant="outline" className="bg-[#228B22]/10 text-[#228B22] border-[#228B22]/20 text-xs">
                        {profileData.role.charAt(0).toUpperCase() + profileData.role.slice(1)} Account
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
              
              <Separator className="my-6" />
              
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground">ACCOUNT SECURITY</h3>
                <div className="p-4 bg-muted/20 rounded-md border">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h4 className="font-medium text-sm">Password</h4>
                      <p className="text-xs text-muted-foreground">Last changed 2 months ago</p>
                    </div>
                    <Button variant="outline" size="sm" className="text-xs" onClick={() => setShowPasswordPopup(true)}>
                      Change Password
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
            {isEditing && (
              <CardFooter className="flex justify-end gap-3 pt-6 border-t">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setIsEditing(false);
                    // Reset form to original data
                    setEditForm({
                      ...profileData,
                      email: profileData.email,
                      phone: profileData.phone,
                    });
                  }}
                  disabled={isLoading}
                  className="px-6"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleSave} 
                  disabled={isLoading}
                  className="px-6"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </Button>
              </CardFooter>
            )}
          </Card>
        </div>

        {/* Full Screen Avatar Preview */}
        {showFullScreenPreview && avatarUrl && (
          <div 
            className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
            onClick={() => setShowFullScreenPreview(false)}
          >
            <div className="relative max-w-4xl w-full max-h-[90vh] flex items-center justify-center">
              <Button 
                variant="ghost" 
                size="icon" 
                className="absolute top-4 right-4 text-white hover:bg-white/20"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowFullScreenPreview(false);
                }}
              >
                <X className="h-6 w-6" />
              </Button>
              <img 
                src={avatarUrl} 
                alt="Profile" 
                className="max-w-full max-h-[80vh] object-contain rounded-lg"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
        )}

        {/* Avatar Upload Popup temporarily disabled */}

        {/* Change Password Popup */}
        <PasswordChangePopup
          isOpen={showPasswordPopup}
          onClose={() => setShowPasswordPopup(false)}
        />
      </div>
    </div>
  )
}