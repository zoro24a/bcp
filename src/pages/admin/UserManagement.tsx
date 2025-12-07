import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { MoreHorizontal, Search, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Profile, AdminListUsersOptions } from "@/lib/types";
import { showError, showSuccess } from "@/utils/toast";
import { supabase } from "@/integrations/supabase/client";
import { fetchProfiles } from "@/data/appData";

// Define a combined user type for display
interface UserDisplay extends Profile {
  auth_id: string;
  last_sign_in_at: string;
}

const AdminUserManagement = () => {
  const [users, setUsers] = useState<UserDisplay[]>([]);
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRole, setSelectedRole] = useState("all"); // New state for role filter
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const PER_PAGE = 10;

  const fetchAllUsers = async (currentPage: number, search: string) => {
    setLoading(true);
    try {
      // 1. Fetch all profiles (to map roles and names)
      const profiles = await fetchProfiles();
      const profilesMap = new Map(profiles.map(p => [p.id, p]));
      setAllProfiles(profiles);

      // 2. Fetch users from auth.users via Edge Function
      const options: AdminListUsersOptions = {
        page: currentPage,
        perPage: PER_PAGE,
        search: search || undefined,
        sortBy: 'created_at',
        sortOrder: 'desc',
      };

      const { data: authData, error: authError } = await supabase.functions.invoke('manage-users', {
        body: JSON.stringify({
          action: 'listUsers',
          payload: { options },
        }),
      });

      if (authError) {
        throw new Error(authError.message);
      }

      const { users: authUsers, total } = authData as { users: any[], total: number };
      
      const combinedUsers: UserDisplay[] = authUsers.map((authUser: any) => {
        const profile = profilesMap.get(authUser.id);
        
        // Combine auth data with profile data
        return {
          auth_id: authUser.id,
          last_sign_in_at: authUser.last_sign_in_at,
          id: profile?.id || authUser.id,
          first_name: profile?.first_name || 'N/A',
          last_name: profile?.last_name || '',
          username: profile?.username || 'N/A',
          email: authUser.email || 'N/A',
          phone_number: profile?.phone_number || 'N/A',
          role: profile?.role || 'unknown', // Default role if profile is missing
        } as UserDisplay;
      });

      // Apply client-side role filtering since Supabase listUsers API doesn't support filtering by user_metadata (role)
      const filteredByRole = selectedRole === 'all'
        ? combinedUsers
        : combinedUsers.filter(user => user.role === selectedRole);

      // Note: We can't easily calculate totalPages based on filtered results without fetching all users,
      // so we will use the total count from the Supabase Auth API for pagination control, 
      // but display only the filtered results.
      // For simplicity and performance, we will only paginate the unfiltered list, 
      // and rely on the role filter being applied after fetching the page.
      // If the user filters by role, the pagination count might be inaccurate, but the displayed data will be correct.
      
      setUsers(filteredByRole);
      setTotalPages(Math.ceil(total / PER_PAGE));

    } catch (error: any) {
      showError("Failed to fetch users: " + error.message);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Refetch data whenever page, search term, or selected role changes
    fetchAllUsers(page, searchTerm);
  }, [page, searchTerm, selectedRole]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1); // Reset to first page on new search
    fetchAllUsers(1, searchTerm);
  };

  const handleRoleChange = (newRole: string) => {
    setSelectedRole(newRole);
    setPage(1); // Reset to first page on role change
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
    }
  };

  const getRoleVariant = (role: string) => {
    switch (role) {
      case 'admin':
        return 'destructive';
      case 'principal':
        return 'purple';
      case 'hod':
        return 'success';
      case 'tutor':
        return 'info';
      case 'student':
        return 'secondary';
      default:
        return 'default';
    }
  };

  const handleDeleteUser = async (userId: string, email: string) => {
    if (!confirm(`Are you sure you want to permanently delete user ${email}? This action is irreversible.`)) {
      return;
    }
    
    setLoading(true);
    try {
      // Deleting the user via Edge Function deletes the auth.users entry,
      // which cascades to the profiles table via RLS trigger.
      const { error } = await supabase.functions.invoke('manage-users', {
        body: JSON.stringify({
          action: 'deleteUser',
          payload: { userId },
        }),
      });

      if (error) {
        throw new Error(error.message);
      }

      showSuccess(`User ${email} deleted successfully.`);
      fetchAllUsers(page, searchTerm); // Refresh list
    } catch (error: any) {
      showError("Failed to delete user: " + error.message);
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4">
        <CardTitle>User Management (All Roles)</CardTitle>
        <div className="flex items-center gap-2 flex-wrap">
          <Select onValueChange={handleRoleChange} defaultValue="all">
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Filter by Role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="principal">Principal</SelectItem>
              <SelectItem value="hod">HOD</SelectItem>
              <SelectItem value="tutor">Tutor</SelectItem>
              <SelectItem value="student">Student</SelectItem>
            </SelectContent>
          </Select>
          <form onSubmit={handleSearch} className="flex gap-2">
            <Input
              placeholder="Search by email or name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-[250px]"
            />
            <Button type="submit" size="icon" disabled={loading}>
              <Search className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </CardHeader>
      <CardContent>
        {loading && (
          <div className="flex justify-center items-center h-40">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}
        {!loading && users.length === 0 && (
          <p className="text-center text-muted-foreground py-10">No users found matching your criteria.</p>
        )}
        {!loading && users.length > 0 && (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Last Sign In</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.auth_id}>
                    <TableCell className="font-medium">
                      {`${user.first_name} ${user.last_name || ''}`.trim()}
                      <div className="text-xs text-muted-foreground">{user.username}</div>
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <Badge variant={getRoleVariant(user.role)}>
                        {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : 'Never'}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem 
                            className="text-destructive"
                            onClick={() => handleDeleteUser(user.auth_id, user.email)}
                          >
                            Delete User
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            
            {/* Pagination Controls */}
            <div className="flex justify-between items-center mt-4">
              <Button 
                variant="outline" 
                onClick={() => handlePageChange(page - 1)} 
                disabled={page === 1 || loading}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button 
                variant="outline" 
                onClick={() => handlePageChange(page + 1)} 
                disabled={page === totalPages || loading}
              >
                Next
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default AdminUserManagement;