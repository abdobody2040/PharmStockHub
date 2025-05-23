import { useState } from "react";
import { MainLayout } from "@/components/layout/main-layout";
import { StockMovementForm } from "@/components/stock/stock-movement-form";
import { Button } from "@/components/ui/button";
import { 
  ArrowLeft, 
  ArrowRight, 
  Calendar, 
  Package, 
  UserCircle 
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  useQuery,
  useMutation 
} from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { 
  StockItem, 
  Category, 
  User, 
  StockMovement 
} from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/utils";

export default function StockMovementPage() {
  const { user, hasPermission } = useAuth();
  const { toast } = useToast();
  const [showMoveStockModal, setShowMoveStockModal] = useState(false);

  // Fetch data
  const { data: stockItems = [] } = useQuery<StockItem[]>({
    queryKey: ["/api/stock-items"],
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: movements = [], isLoading: isLoadingMovements } = useQuery<StockMovement[]>({
    queryKey: ["/api/movements"],
  });

  // Create movement mutation
  const createMovementMutation = useMutation({
    mutationFn: async (movementData: any) => {
      const res = await apiRequest("POST", "/api/movements", movementData);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/movements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stock-items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/allocations"] });
      setShowMoveStockModal(false);
      toast({
        title: "Success",
        description: "Stock movement created successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to move stock",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Helpers to get related data
  const getStockItemById = (id: number) => {
    return stockItems.find(item => item.id === id);
  };

  const getCategoryById = (id: number) => {
    return categories.find(cat => cat.id === id);
  };

  const getUserById = (id: number | null): Partial<User> & { name: string, role: string, region: string | null } => {
    if (id === null) return { name: "Central Warehouse", role: "warehouse", region: null };
    return users.find(user => user.id === id) || { name: "Unknown User", role: "unknown", region: null };
  };

  const handleSubmitMovement = (data: any) => {
    createMovementMutation.mutate(data);
  };

  return (
    <MainLayout>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Stock Movement</h2>
        {hasPermission("canMoveStock") && (
          <Button onClick={() => setShowMoveStockModal(true)}>
            <ArrowRight className="mr-2 h-4 w-4" />
            Move Stock
          </Button>
        )}
      </div>

      {/* Stock Movement History */}
      <Card className="mb-6">
        <CardHeader className="px-6 py-4 border-b border-gray-200">
          <CardTitle className="text-lg font-medium">Stock Movement History</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {isLoadingMovements ? (
            <div className="flex justify-center py-10">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
            </div>
          ) : movements.length === 0 ? (
            <div className="text-center py-10">
              <ArrowLeft className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-700">No movement history</h3>
              <p className="text-gray-500 mt-2">Start moving items between users to see history here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Processed By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements.map((movement) => {
                    const stockItem = getStockItemById(movement.stockItemId);
                    const fromUser = getUserById(movement.fromUserId);
                    const toUser = getUserById(movement.toUserId);
                    const movedByUser = getUserById(movement.movedBy);
                    
                    return (
                      <TableRow key={movement.id}>
                        <TableCell>
                          <div className="flex items-center">
                            <Calendar className="h-4 w-4 text-gray-400 mr-2" />
                            <span className="text-sm text-gray-500">{formatDate(movement.movedAt)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center">
                            <div className="h-10 w-10 flex-shrink-0">
                              {stockItem?.imageUrl ? (
                                <img 
                                  src={stockItem.imageUrl}
                                  alt={stockItem.name}
                                  className="h-10 w-10 rounded object-cover"
                                />
                              ) : (
                                <div className="h-10 w-10 rounded bg-gray-200 flex items-center justify-center">
                                  <Package className="h-5 w-5 text-gray-500" />
                                </div>
                              )}
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">{stockItem?.name || "Unknown Item"}</div>
                              <div className="text-sm text-gray-500">{stockItem?.uniqueNumber || "—"}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center">
                            <UserCircle className="h-4 w-4 text-gray-400 mr-2" />
                            <div>
                              <div className="text-sm text-gray-900">{fromUser?.name}</div>
                              <div className="text-sm text-gray-500">
                                {fromUser?.role === "warehouse" ? "Main Storage" : fromUser?.region || "—"}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center">
                            <UserCircle className="h-4 w-4 text-gray-400 mr-2" />
                            <div>
                              <div className="text-sm text-gray-900">{toUser?.name}</div>
                              <div className="text-sm text-gray-500">
                                {toUser?.role === "warehouse" ? "Main Storage" : `${toUser?.role} - ${toUser?.region || "No region"}`}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-gray-900">{movement.quantity}</TableCell>
                        <TableCell className="text-sm text-gray-900">{movedByUser?.name}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Move Stock Modal */}
      <Dialog open={showMoveStockModal} onOpenChange={setShowMoveStockModal}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Move Stock</DialogTitle>
            <DialogDescription>
              Select items and recipients to create a stock transfer.
            </DialogDescription>
          </DialogHeader>
          
          <StockMovementForm
            onSubmit={handleSubmitMovement}
            isLoading={createMovementMutation.isPending}
          />
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMoveStockModal(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
