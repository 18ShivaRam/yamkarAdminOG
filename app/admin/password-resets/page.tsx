"use client";

import { useEffect, useMemo, useState } from "react";
import { apiClient } from "@/lib/api-interceptor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import { ChevronsUpDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

type UserLite = { id: string; name: string | null; email: string | null; phone: string | null; role: string | null };

export default function PasswordResetsPage() {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserLite[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [password, setPassword] = useState<string>("");
  const [usersError, setUsersError] = useState<string>("");
  const [isUserPickerOpen, setIsUserPickerOpen] = useState(false);

  const selectedUser = useMemo(() => users.find(u => u.id === selectedUserId) || null, [users, selectedUserId]);

  const loadUsers = async () => {
    setIsLoadingUsers(true);
    setUsersError("");
    try {
      const res = await apiClient.get("/api/admin/users/list");
      if (!res.success) throw new Error(res.error || "Failed to fetch users");
      const arr = (res.data?.users || []) as UserLite[];
      setUsers(arr);
    } catch (e: any) {
      const msg = e.message || "Could not load users";
      setUsersError(msg);
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setIsLoadingUsers(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleReset = async () => {
    if (!selectedUserId) {
      toast({ title: "Select user", description: "Please select a user to reset password.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await apiClient.post("/api/admin/users/reset-password", {
        userId: selectedUserId,
        newPassword: password?.trim() || "user@123",
      }, { loadingText: "Resetting password..." });

      if (!res.success) throw new Error(res.error || "Failed to reset password");

      const used = password?.trim() || "user@123";
      toast({ title: "Password reset", description: `Temporary password set to ${used} for ${selectedUser?.name || "user"}.` });
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to reset password", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Password Resets</CardTitle>
          <CardDescription>Select a username and set their password to a default temporary value.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="space-y-2">
              <Label>User Name</Label>
              <Popover open={isUserPickerOpen} onOpenChange={setIsUserPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={isUserPickerOpen}
                    className="w-full justify-between"
                    disabled={isLoadingUsers}
                  >
                    <span className={cn("truncate", !selectedUser && "text-muted-foreground")}> 
                      {selectedUser
                        ? (selectedUser.name || selectedUser.email || selectedUser.phone || selectedUser.id)
                        : (isLoadingUsers ? "Loading users..." : "Search or select a user")}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                  <Command>
                    <CommandInput placeholder="Search user by name" />
                    <CommandEmpty>No users found.</CommandEmpty>
                    <CommandGroup>
                      {users.map((u) => {
                        const label = u.name || u.email || u.phone || u.id;
                        const isActive = selectedUserId === u.id;
                        return (
                          <CommandItem
                            key={u.id}
                            value={label || u.id}
                            onSelect={() => {
                              setSelectedUserId(u.id);
                              setIsUserPickerOpen(false);
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", isActive ? "opacity-100" : "opacity-0")} />
                            <span className="truncate">{label}</span>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
              {usersError && (
                <div className="text-xs text-gray-600 mt-1 flex items-center gap-2">
                  <span>{usersError}</span>
                  <Button type="button" size="sm" variant="outline" onClick={loadUsers}>Retry</Button>
                </div>
              )}
            </div>

            {selectedUser && (
              <div className="rounded-md border p-4 bg-[#F8F8FF]">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div><span className="font-medium">Email:</span> {selectedUser.email || "-"}</div>
                  <div><span className="font-medium">Phone:</span> {selectedUser.phone || "-"}</div>
                  <div><span className="font-medium">Role:</span> {selectedUser.role || "-"}</div>
                  <div className="truncate"><span className="font-medium">User ID:</span> {selectedUser.id}</div>
                </div>
              </div>
            )}

            <Separator />

            <div className="space-y-2">
              <Label>Temporary Password</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Enter a temporary password (default is user@123)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <Button type="button" variant="secondary" onClick={() => setPassword("user@123")}>Generate</Button>
              </div>
              {!password.trim() ? (
                <div className="text-xs text-gray-600">Temporary password is required. Enter one or use Generate.</div>
              ) : (
                <div className="text-xs text-gray-600">Ready to reset password.</div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Button onClick={handleReset} disabled={isSubmitting || !selectedUserId || !password.trim()} className="bg-[#228B22] hover:bg-[#1b6e1b]">
                {isSubmitting ? "Resetting..." : "Reset Password"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
