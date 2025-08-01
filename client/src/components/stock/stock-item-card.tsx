import { useState } from "react";
import { 
  Card, 
  CardContent
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Eye,
  Edit,
  Trash2,
  QrCode
} from "lucide-react";
import { 
  cn, 
  formatDate, 
  getExpiryStatus, 
  getExpiryStatusColor, 
  getCategoryColorClass 
} from "@/lib/utils";
import { StockItem, Category } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { Badge } from "@/components/ui/badge";
import { BarcodeActions } from "@/components/barcode/barcode-actions";

interface StockItemCardProps {
  item: StockItem;
  category: Category;
  onView: (item: StockItem) => void;
  onEdit?: (item: StockItem) => void;
  onDelete?: (item: StockItem) => void;
  className?: string;
}

export function StockItemCard({ 
  item, 
  category,
  onView, 
  onEdit, 
  onDelete,
  className 
}: StockItemCardProps) {
  const { hasPermission } = useAuth();
  const [isHovered, setIsHovered] = useState(false);
  
  const expiryStatus = getExpiryStatus(item.expiry);
  const expiryStatusColor = getExpiryStatusColor(expiryStatus);
  const categoryColor = getCategoryColorClass(category.name);
  
  return (
    <Card 
      className={cn(
        "overflow-hidden transition-shadow hover:shadow-md",
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="relative h-48 w-full overflow-hidden">
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.name}
            className="h-full w-full object-cover transition-transform duration-300"
            style={{
              transform: isHovered ? 'scale(1.05)' : 'scale(1)'
            }}
          />
        ) : (
          <div className="h-full w-full bg-gray-200 flex items-center justify-center">
            <span className="text-gray-400">No Image</span>
          </div>
        )}
      </div>
      
      <CardContent className="p-4">
        <div className="flex justify-between">
          <h3 className="text-lg font-medium text-gray-900 line-clamp-1">{item.name}</h3>
          <span className="text-sm text-gray-500">{item.uniqueNumber}</span>
        </div>
        
        <div className="mt-2 flex justify-between items-center">
          <Badge variant="outline" className={cn("font-medium", categoryColor)}>
            {category.name}
          </Badge>
          <span className="text-sm font-medium text-gray-900">Qty: {item.quantity}</span>
        </div>

        <div className="mt-2 flex justify-between items-center">
          <span className="text-sm text-gray-700">Unit Price:</span>
          <span className="text-sm font-medium text-gray-900">
            ${item.price ? (item.price / 100).toFixed(2) : '0.00'}
          </span>
        </div>

        <div className="mt-1 flex justify-between items-center">
          <span className="text-sm text-gray-700">Total Value:</span>
          <span className="text-sm font-medium text-emerald-600">
            ${item.price ? ((item.price * item.quantity) / 100).toFixed(2) : '0.00'}
          </span>
        </div>
        
        <div className="mt-3 flex justify-between items-center">
          <div className="flex flex-col">
            <span className="text-sm text-gray-600">Expires: {formatDate(item.expiry)}</span>
            {item.expiry && (
              <Badge variant="outline" className={cn("mt-1", expiryStatusColor)}>
                {expiryStatus === 'expired' ? 'Expired' : 
                 expiryStatus === 'critical' ? 'Critical' : 
                 expiryStatus === 'warning' ? 'Warning' : 'Safe'}
              </Badge>
            )}
          </div>
          
          <div className="flex space-x-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onView(item)}
              className="text-primary hover:text-primary-600"
            >
              <Eye className="h-4 w-4" />
            </Button>
            
            {hasPermission('canEditItems') && onEdit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit(item)}
                className="text-green-600 hover:text-green-800"
              >
                <Edit className="h-4 w-4" />
              </Button>
            )}
            
            {hasPermission('canRemoveItems') && onDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(item)}
                className="text-red-600 hover:text-red-800"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            
            {item.uniqueNumber && (
              <div className="ml-1">
                <BarcodeActions
                  value={item.uniqueNumber}
                  buttonVariant="ghost"
                  buttonSize="sm"
                  showScan={false}
                  showGenerate={true}
                />
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
