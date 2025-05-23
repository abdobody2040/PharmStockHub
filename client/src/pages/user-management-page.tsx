import { useState } from "react";
import { MainLayout } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
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
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { User, RoleType, Specialty } from "@shared/schema";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { cn, getRoleColor, getRoleName, getPlaceholderAvatar } from "@/lib/utils";
import {
  Search,
  Plus,
  Edit,
  Trash2,
  UserCircle,
  Users,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const userFormSchema = z.object({
  name: z.string().min(2, "Full name is required"),
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters").optional(),
  role: z.enum(["ceo", "marketer", "salesManager", "stockManager", "admin", "medicalRep"] as [RoleType, ...RoleType[]]),
  region: z.string().optional(),
  specialtyId: z.string().optional(),
});

type UserFormValues = z.infer<typeof userFormSchema>;

export default function UserManagementPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState<string | null>(null);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Fetch users
  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: specialties = [] } = useQuery<Specialty[]>({
    queryKey: ["/api/specialties"],
  });

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async (userData: UserFormValues) => {
      const res = await apiRequest("POST", "/api/register", userData);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setShowAddUserModal(false);
      toast({
        title: "Success",
        description: "User created successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create user",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: async ({ id, userData }: { id: number, userData: Partial<UserFormValues> }) => {
      const res = await apiRequest("PUT", `/api/users/${id}`, userData);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setShowEditUserModal(false);
      setSelectedUser(null);
      toast({
        title: "Success",
        description: "User updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update user",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setShowDeleteConfirm(false);
      setSelectedUser(null);
      toast({
        title: "Success",
        description: "User deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete user",
        description: error.message,
        variant: "destructive",
      });
      // Close the dialog even on error
      setShowDeleteConfirm(false);
    },
  });

  // Add user form
  const addUserForm = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      name: "",
      username: "",
      password: "",
      role: "medicalRep",
      region: "",
      specialtyId: "",
    },
  });

  // Edit user form
  const editUserForm = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema.omit({ password: true }).extend({
      password: z.string().min(6, "Password must be at least 6 characters").optional(),
    })),
    defaultValues: {
      name: "",
      username: "",
      role: "medicalRep",
      region: "",
      specialtyId: "",
    },
  });

  // Handle user actions
  const handleAddUser = (data: UserFormValues) => {
    createUserMutation.mutate(data);
  };

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    editUserForm.reset({
      name: user.name,
      username: user.username,
      role: user.role as RoleType,
      region: user.region || "",
      specialtyId: user.specialtyId !== null && user.specialtyId !== undefined ? String(user.specialtyId) : "",
    });
    setShowEditUserModal(true);
  };

  const handleUpdateUser = (data: UserFormValues) => {
    if (!selectedUser) return;

    // Only include password if provided
    const updateData = { ...data };
    if (!updateData.password) {
      delete updateData.password;
    }

    updateUserMutation.mutate({ id: selectedUser.id, userData: updateData });
  };

  const handleDeleteUser = (user: User) => {
    setSelectedUser(user);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteUser = () => {
    if (selectedUser) {
      deleteUserMutation.mutate(selectedUser.id);
    }
  };

  // Filter users
  const filteredUsers = users.filter(u => {
    // Role filter
    if (filterRole && u.role !== filterRole) {
      return false;
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      return (
        u.name.toLowerCase().includes(query) ||
        u.username.toLowerCase().includes(query) ||
        (u.region && u.region.toLowerCase().includes(query)) ||
        getRoleName(u.role).toLowerCase().includes(query)
      );
    }

    return true;
  });

  // Get counts by role
  const userCounts = {
    all: users.length,
    ceo: users.filter(u => u.role === 'ceo').length,
    marketer: users.filter(u => u.role === 'marketer').length,
    salesManager: users.filter(u => u.role === 'salesManager').length,
    stockManager: users.filter(u => u.role === 'stockManager').length,
    admin: users.filter(u => u.role === 'admin').length,
    medicalRep: users.filter(u => u.role === 'medicalRep').length,
  };

  return (
    <MainLayout onSearch={setSearchQuery}>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">User Management</h2>
        <Button onClick={() => setShowAddUserModal(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add New User
        </Button>
      </div>

      {/* Role filter tabs */}
      <div className="mb-6 overflow-x-auto">
        <Tabs defaultValue="all" value={filterRole || 'all'} onValueChange={setFilterRole as any}>
          <TabsList className="inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground">
            <TabsTrigger value="all" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              All
              <Badge variant="secondary" className="ml-1">{userCounts.all}</Badge>
            </TabsTrigger>
            <TabsTrigger value="ceo" className="flex items-center gap-2">
              CEO
              <Badge variant="secondary" className="ml-1">{userCounts.ceo}</Badge>
            </TabsTrigger>
            <TabsTrigger value="marketer" className="flex items-center gap-2">
              Marketers
              <Badge variant="secondary" className="ml-1">{userCounts.marketer}</Badge>
            </TabsTrigger>
            <TabsTrigger value="salesManager" className="flex items-center gap-2">
              Sales Managers
              <Badge variant="secondary" className="ml-1">{userCounts.salesManager}</Badge>
            </TabsTrigger>
            <TabsTrigger value="stockManager" className="flex items-center gap-2">
              Stock Managers
              <Badge variant="secondary" className="ml-1">{userCounts.stockManager}</Badge>
            </TabsTrigger>
            <TabsTrigger value="admin" className="flex items-center gap-2">
              Admins
              <Badge variant="secondary" className="ml-1">{userCounts.admin}</Badge>
            </TabsTrigger>
            <TabsTrigger value="medicalRep" className="flex items-center gap-2">
              Medical Reps
              <Badge variant="secondary" className="ml-1">{userCounts.medicalRep}</Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Users list */}
      <Card>
        <CardHeader className="px-6 py-4 border-b border-gray-200">
          <CardTitle className="text-lg font-medium">Users</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-10">
              <UserCircle className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-700">No users found</h3>
              <p className="text-gray-500 mt-2">Try adjusting your search or filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Username</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Region</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div className="flex items-center">
                          <Avatar>
                            <AvatarImage src={u.avatar || getPlaceholderAvatar(u.name)} />
                            <AvatarFallback>{u.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div className="ml-3">
                            <div className="text-sm font-medium text-gray-900">{u.name}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">{u.username}</TableCell>
                      <TableCell>
                        <Badge
                          className={cn(
                            getRoleColor(u.role).replace("bg-", "bg-").replace("-500", "-100"),
                            getRoleColor(u.role).replace("bg-", "text-").replace("-500", "-800")
                          )}
                        >
                          {getRoleName(u.role)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">{u.region || "—"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditUser(u)}
                            className="text-green-600 hover:text-green-800"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteUser(u)}
                            className="text-red-600 hover:text-red-800"
                            disabled={u.id === user?.id} // Prevent deleting yourself
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add User Modal */}
      <Dialog open={showAddUserModal} onOpenChange={setShowAddUserModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New User</DialogTitle>
            <DialogDescription>
              Create a new user account. All fields are required except region.
            </DialogDescription>
          </DialogHeader>

          <Form {...addUserForm}>
            <form onSubmit={addUserForm.handleSubmit(handleAddUser)} className="space-y-4">
              <FormField
                control={addUserForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter full name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={addUserForm.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter username" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={addUserForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Enter password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={addUserForm.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="ceo">CEO</SelectItem>
                        <SelectItem value="marketer">Marketer</SelectItem>
                        <SelectItem value="salesManager">Sales Manager</SelectItem>
                        <SelectItem value="stockManager">Stock Manager</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="medicalRep">Medical Rep</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={addUserForm.control}
                name="region"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Region (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter region" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={addUserForm.control}
                name="specialtyId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Specialty</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select specialty" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="0">No specialty</SelectItem>
                        {specialties.map((specialty) => (
                          <SelectItem key={specialty.id} value={specialty.id.toString()}>
                            {specialty.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Assign a specialty to this user
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button 
                  type="submit" 
                  disabled={createUserMutation.isPending}
                >
                  {createUserMutation.isPending ? "Creating..." : "Create User"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit User Modal */}
      <Dialog open={showEditUserModal} onOpenChange={setShowEditUserModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user information. Leave password blank to keep it unchanged.
            </DialogDescription>
          </DialogHeader>

          <Form {...editUserForm}>
            <form onSubmit={editUserForm.handleSubmit(handleUpdateUser)} className="space-y-4">
              <FormField
                control={editUserForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter full name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editUserForm.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter username" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editUserForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password (Leave blank to keep unchanged)</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Enter new password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editUserForm.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="ceo">CEO</SelectItem>
                        <SelectItem value="marketer">Marketer</SelectItem>
                        <SelectItem value="salesManager">Sales Manager</SelectItem>
                        <SelectItem value="stockManager">Stock Manager</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="medicalRep">Medical Rep</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editUserForm.control}
                name="region"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Region (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter region" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editUserForm.control}
                name="specialtyId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Specialty</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select specialty" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="0">No specialty</SelectItem>
                        {specialties.map((specialty) => (
                          <SelectItem key={specialty.id} value={specialty.id.toString()}>
                            {specialty.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Assign a specialty to this user
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button 
                  type="submit" 
                  disabled={updateUserMutation.isPending}
                >
                  {updateUserMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the user account for "{selectedUser?.name}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteUser}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteUserMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}