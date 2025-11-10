"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Users, Search, Edit, Phone, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/components/ui/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface UserData {
  id: string;
  name: string;
  role: string;
  state?: { id: string; state_name: string };
  district?: { id: string; district_name: string };
  cadres?: { id: string; name: string };
  manager?: { id: string; name: string };
  mandal?: { id: string; mandal_name: string };
  village?: { id: string; village_name: string };
  state_id?: string;
  district_id?: string;
  mandal_id?: string;
  village_id?: string;
}

interface UserResponse {
  id: string;
  name: string;
  role: string;
  state_id: string | null;
  district_id: string | null;
  cadre?: string | null;
  manager_id?: string | null;
  mandal_id?: string | null;
  village_id?: string | null;
  state?: { id: string; state_name: string } | null;
  district?: { id: string; district_name: string } | null;
  cadres?: { id: string; name: string } | null;
  manager?: { id: string; name: string } | null;
  mandal?: { id: string; mandal_name: string } | null;
  village?: { id: string; village_name: string } | null;
}

export default function ApprovalsPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [approvals, setApprovals] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [managers, setManagers] = useState<any[]>([]);
  const [cadres, setCadres] = useState<any[]>([]);
  const [states, setStates] = useState<any[]>([]);
  const [districts, setDistricts] = useState<any[]>([]);
  const [mandals, setMandals] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchApprovals();
    fetchManagers();
    fetchCadres();
    fetchStates();
  }, []);

  const fetchApprovals = async () => {
    const { data, error } = await supabase
      .from('users')
      .select(`
        *,
        cadre(name),
        manager:manager_id(name),
        state(state_name),
        district(district_name),
        mandal(mandal_name)
      `)
      .eq('status', 'pending');

    if (error) {
      console.error("Error fetching approvals:", error);
      return;
    }

    setApprovals(data);
  };

  const fetchManagers = async () => {
    const { data, error } = await supabase
      .from('users')
      .select('id, name')
      .eq('role', 'manager')
      .eq('status', 'approved');

    if (error) {
      console.error("Error fetching managers:", error);
      return;
    }

    setManagers(data);
  };

  const fetchCadres = async () => {
    const { data, error } = await supabase
      .from('cadres')
      .select('*');

    if (error) {
      console.error("Error fetching cadres:", error);
      return;
    }

    setCadres(data);
  };

  const fetchStates = async () => {
    const { data, error } = await supabase
      .from('states')
      .select('*');

    if (error) {
      console.error("Error fetching states:", error);
      return;
    }

    setStates(data);
  };

  const fetchDistricts = async (stateId: string) => {
    const { data, error } = await supabase
      .from('districts')
      .select('*')
      .eq('state_id', stateId);

    if (error) {
      console.error("Error fetching districts:", error);
      return;
    }

    setDistricts(data);
  };

  const fetchMandals = async (districtId: string) => {
    const { data, error } = await supabase
      .from('mandals')
      .select('*')
      .eq('district_id', districtId);

    if (error) {
      console.error("Error fetching mandals:", error);
      return;
    }

    setMandals(data);
  };

  const handleEdit = async (user: any) => {
    try {
      // Base query with common fields
      let query = `
        id,
        name,
        role,
        phone,
        state,
        district,
        states(id, state_name),
        districts(id, district_name)
      `;

      // Add additional fields for employee role
      if (user.role === 'employee') {
        query += `,
          cadre,
          manager_id,
          mandal,
          cadres(id, name),
          manager:manager_id(id, name),
          mandals(id, mandal_name)
        `;
      }

      // Fetch user details with role-specific fields
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select(query)
        .eq('id', user.id)
        .single();

      if (userError) throw userError;
      if (!userData) throw new Error('User data not found');

      // Set the selected user with complete details
      const userDetails = {
        id: userData.id,
        name: userData.name,
        role: userData.role,
        phone: userData.phone,
        state_id: userData.state,
        district_id: userData.district,
        ...(user.role === 'employee' && {
          cadre_id: userData.cadre,
          manager_id: userData.manager_id,
          mandal_id: userData.mandal
        })
      };

      setSelectedUser(userDetails);

      // Fetch related data for dropdowns based on role
      if (userDetails.state_id) {
        await fetchDistricts(userDetails.state_id);
        if (user.role === 'employee' && userDetails.district_id) {
          await fetchMandals(userDetails.district_id);
        }
      }

      setIsEditDialogOpen(true);
    } catch (error) {
      console.error("Error fetching user details:", error);
      toast({
        title: "Error",
        description: "Failed to fetch user details",
        variant: "destructive",
      });
    }
  };

  const handleUpdate = async () => {
    if (!selectedUser) return;

    setIsLoading(true);
    try {
      // Validate required fields based on role
      if (!selectedUser.name) {
        throw new Error("Please fill in all required fields");
      }

      const updateData: Record<string, any> = {
        name: selectedUser.name,
        state: selectedUser.state_id,
        district: selectedUser.district_id,
      };

      // Add additional fields for employee role
      if (selectedUser.role === 'employee') {
        if (!selectedUser.cadre_id || !selectedUser.manager_id) {
          throw new Error("Please fill in all required fields");
        }
        updateData.cadre = selectedUser.cadre_id;
        updateData.manager_id = selectedUser.manager_id;
        updateData.mandal = selectedUser.mandal_id;
      }

      const { error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', selectedUser.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "User details updated successfully",
      });
      
      setIsEditDialogOpen(false);
      fetchApprovals();
    } catch (error: any) {
      console.error("Error updating user:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update user details",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ status: 'approved' })
        .eq('id', id);

      if (error) {
        console.error("Error approving user:", error);
        toast({
          title: "Error",
          description: "Failed to approve user",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Request Approved",
        description: "The account request has been approved successfully.",
        duration: 3000,
      });
      fetchApprovals();
    } catch (error) {
      console.error("Error during approval:", error);
      toast({
        title: "Error",
        description: "Failed to approve user",
        variant: "destructive",
      });
    }
  };

  const handleReject = async (id: string) => {
    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', id);

      if (error) {
        console.error("Error rejecting user:", error);
        toast({
          title: "Error",
          description: "Failed to reject user",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Request Rejected",
        description: "The account request has been rejected.",
        duration: 3000,
      });
      fetchApprovals();
    } catch (error) {
      console.error("Error during rejection:", error);
      toast({
        title: "Error",
        description: "Failed to reject user",
        variant: "destructive",
      });
    }
  };

  const filteredApprovals = approvals.filter((approval: any) => {
    const matchesSearch =
      approval.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      approval.email.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType = filterType === "all" || approval.role === filterType;

    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#228B22]">Pending Approvals</h1>
        <p className="text-[#6B8E23]">Review and manage account requests</p>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#6B8E23]" />
          <Input
            placeholder="Search requests..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-full md:w-[180px]">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Requests</SelectItem>
            <SelectItem value="manager">Manager</SelectItem>
            <SelectItem value="employee">Employee</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-4">
        {filteredApprovals.length > 0 ? (
          filteredApprovals.map((approval: any) => (
            <Card key={approval.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex flex-col gap-3">
                  {/* User Info Section with Edit Icon */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={`/placeholder.svg?height=36&width=36`} alt={approval.name} />
                        <AvatarFallback className="bg-[#6B8E23] text-white text-sm">
                          {approval.name
                            .split(" ")
                            .map((n: string) => n[0])
                            .join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium text-sm">{approval.name}</div>
                        <div className="text-xs text-[#6B8E23]">{approval.email}</div>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleEdit(approval)}
                      className="p-1.5 text-[#228B22] hover:text-[#1a6b1a] transition-colors"
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Role, Phone and Action Buttons in one line */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 text-[#6B8E23]" />
                        <Badge variant="outline" className="text-[10px] px-2 py-0">
                          {approval.role.charAt(0).toUpperCase() + approval.role.slice(1)}
                        </Badge>
                      </div>
                      {approval.phone && (
                        <div className="flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5 text-[#6B8E23]" />
                          <span className="text-[11px] text-gray-600">
                            {approval.phone}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        onClick={() => handleApprove(approval.id)} 
                        className="bg-[#228B22] hover:bg-[#1a6b1a] h-6 px-2.5 text-[10px]"
                      >
                        Approve
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleReject(approval.id)}
                        className="border-[#E2725B] text-[#E2725B] hover:bg-[#E2725B] hover:text-white h-6 px-2.5 text-[10px]"
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="text-center p-8">
            <div className="text-[#D3D3D3] mb-2">No pending approvals</div>
            <div className="text-sm">All requests have been processed</div>
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto pr-8">
          <DialogHeader className="sticky top-0 bg-white z-10 pb-4 border-b">
            <DialogTitle>Edit User Details</DialogTitle>
            <DialogDescription>
              Review and edit user details before approval
            </DialogDescription>
          </DialogHeader>
          <div className="absolute right-4 top-4 z-50">
            <button
              onClick={() => setIsEditDialogOpen(false)}
              className="rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </button>
          </div>
          {selectedUser && (
            <div className="py-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={selectedUser.name}
                    onChange={(e) => setSelectedUser({ ...selectedUser, name: e.target.value })}
                  />
                </div>

                {selectedUser.phone && (
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      value={selectedUser.phone}
                      disabled
                      className="bg-gray-50"
                    />
                  </div>
                )}

                {selectedUser.role === 'employee' && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="cadre">Cadre</Label>
                      <Select
                        value={selectedUser.cadre_id}
                        onValueChange={(value) => setSelectedUser({ ...selectedUser, cadre_id: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select cadre" />
                        </SelectTrigger>
                        <SelectContent>
                          {cadres.map((cadre) => (
                            <SelectItem key={cadre.id} value={cadre.id}>
                              {cadre.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="manager">Manager</Label>
                      <Select
                        value={selectedUser.manager_id}
                        onValueChange={(value) => setSelectedUser({ ...selectedUser, manager_id: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select manager" />
                        </SelectTrigger>
                        <SelectContent>
                          {managers.map((manager) => (
                            <SelectItem key={manager.id} value={manager.id}>
                              {manager.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Select
                    value={selectedUser.state_id}
                    onValueChange={(value) => {
                      setSelectedUser({ ...selectedUser, state_id: value, district_id: null, mandal_id: null });
                      fetchDistricts(value);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent>
                      {states.map((state) => (
                        <SelectItem key={state.id} value={state.id}>
                          {state.state_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="district">District</Label>
                  <Select
                    value={selectedUser.district_id}
                    onValueChange={(value) => {
                      setSelectedUser({ ...selectedUser, district_id: value, mandal_id: null });
                      if (selectedUser.role === 'employee') {
                        fetchMandals(value);
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select district" />
                    </SelectTrigger>
                    <SelectContent>
                      {districts.map((district) => (
                        <SelectItem key={district.id} value={district.id}>
                          {district.district_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedUser.role === 'employee' && (
                  <div className="space-y-2">
                    <Label htmlFor="mandal">Mandal</Label>
                    <Select
                      value={selectedUser.mandal_id}
                      onValueChange={(value) => setSelectedUser({ ...selectedUser, mandal_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select mandal" />
                      </SelectTrigger>
                      <SelectContent>
                        {mandals.map((mandal) => (
                          <SelectItem key={mandal.id} value={mandal.id}>
                            {mandal.mandal_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter className="sticky bottom-0 bg-white pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
              className="border-[#6B8E23] text-[#6B8E23] hover:bg-[#6B8E23] hover:text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={isLoading}
              className="bg-[#228B22] hover:bg-[#1a6b1a]"
            >
              {isLoading ? "Updating..." : "Update Details"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
