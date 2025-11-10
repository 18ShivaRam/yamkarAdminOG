import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Mail, Phone, User, MapPin, IdCard, Car, FileText, Users, ChevronRight } from "lucide-react";

interface Manager {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  state?: string;
  district?: string;
  mandal?: string;
  village?: string;
  aadhar_number?: string;
  pan_number?: string;
  driving_license?: string;
  employeeCount?: number;
  address?: string;
}

interface ManagerDetailsPopupProps {
  manager: Manager;
}

const ManagerDetailsPopup: React.FC<ManagerDetailsPopupProps> = ({ manager }) => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-[#6B8E23]">
          <span className="flex items-center gap-1">
            View Details
            <ChevronRight className="h-4 w-4" />
          </span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Manager Details</DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="h-[600px] pr-4">
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-[#6B8E23]" />
                <span className="font-medium">{manager.name}</span>
              </div>

              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-[#6B8E23]" />
                <span>{manager.email || "No email available"}</span>
              </div>

              <div className="flex items-center gap-2">
                <Phone className="h-5 w-5 text-[#6B8E23]" />
                <span>{manager.phone || "No phone number available"}</span>
              </div>

              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-[#6B8E23]" />
                <span>Employees under management: {manager.employeeCount || 0}</span>
              </div>

              <div className="border-t border-gray-200 my-2 pt-2">
                <h3 className="font-medium text-gray-700 mb-2">Identification</h3>
                
                <div className="flex items-center gap-2 my-2">
                  <IdCard className="h-5 w-5 text-[#6B8E23]" />
                  <span>Aadhaar: {manager.aadhar_number || "Not provided"}</span>
                </div>

                <div className="flex items-center gap-2 my-2">
                  <FileText className="h-5 w-5 text-[#6B8E23]" />
                  <span>PAN: {manager.pan_number || "Not provided"}</span>
                </div>

                <div className="flex items-center gap-2 my-2">
                  <Car className="h-5 w-5 text-[#6B8E23]" />
                  <span>Driving License: {manager.driving_license || "Not provided"}</span>
                </div>
              </div>

              <div className="border-t border-gray-200 my-2 pt-2">
                <h3 className="font-medium text-gray-700 mb-2">Address</h3>
                
                <div className="flex gap-2">
                  <MapPin className="h-5 w-5 text-[#6B8E23] mt-0.5 flex-shrink-0" />
                  <div>
                    {manager.address ? (
                      <div>{manager.address}</div>
                    ) : (
                      manager.village || manager.mandal || manager.district || manager.state ? (
                        <div className="space-y-1">
                          {manager.village && manager.village !== "Unknown" && <div>Village: {manager.village}</div>}
                          {manager.mandal && manager.mandal !== "Unknown" && <div>Mandal: {manager.mandal}</div>}
                          {manager.district && manager.district !== "Unknown" && <div>District: {manager.district}</div>}
                          {manager.state && manager.state !== "Unknown" && <div>State: {manager.state}</div>}
                          
                          {!manager.village && !manager.mandal && !manager.district && !manager.state && (
                            <span>Address information not available</span>
                          )}
                          {(manager.village === "Unknown" && manager.mandal === "Unknown" && 
                            manager.district === "Unknown" && manager.state === "Unknown") && (
                            <span>Address information not available</span>
                          )}
                        </div>
                      ) : (
                        <span>Address information not available</span>
                      )
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default ManagerDetailsPopup; 