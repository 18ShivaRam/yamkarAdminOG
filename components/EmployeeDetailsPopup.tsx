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
import { Mail, Phone, User, Building, MapPin, IdCard, Car, FileText, ChevronRight } from "lucide-react";

interface Employee {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  manager?: { name: string };
  cadre?: { name: string };
  // Identification fields
  aadhar_number?: string;
  pan_number?: string;
  driving_license?: string;
  // Address related fields
  address?: string;
  state?: string;
  district?: string;
  mandal?: string;
  village?: string;
}

interface EmployeeDetailsPopupProps {
  employee: Employee;
}

const EmployeeDetailsPopup: React.FC<EmployeeDetailsPopupProps> = ({ employee }) => {
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
          <DialogTitle>Employee Details</DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="h-[600px] pr-4">
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-[#6B8E23]" />
                <span className="font-medium">{employee.name}</span>
              </div>

              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-[#6B8E23]" />
                <span>{employee.email || "No email available"}</span>
              </div>

              <div className="flex items-center gap-2">
                <Phone className="h-5 w-5 text-[#6B8E23]" />
                <span>{employee.phone || "No phone number available"}</span>
              </div>

              <div className="flex items-center gap-2">
                <Building className="h-5 w-5 text-[#6B8E23]" />
                <span>Manager: {employee.manager?.name || "Not assigned"}</span>
              </div>

              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-[#6B8E23]" />
                <span>Cadre: {employee.cadre?.name || "Not assigned"}</span>
              </div>

              <div className="border-t border-gray-200 my-2 pt-2">
                <h3 className="font-medium text-gray-700 mb-2">Identification</h3>
                
                <div className="flex items-center gap-2 my-2">
                  <IdCard className="h-5 w-5 text-[#6B8E23]" />
                  <span>Aadhaar: {employee.aadhar_number || "Not provided"}</span>
                </div>

                <div className="flex items-center gap-2 my-2">
                  <FileText className="h-5 w-5 text-[#6B8E23]" />
                  <span>PAN: {employee.pan_number || "Not provided"}</span>
                </div>

                <div className="flex items-center gap-2 my-2">
                  <Car className="h-5 w-5 text-[#6B8E23]" />
                  <span>Driving License: {employee.driving_license || "Not provided"}</span>
                </div>
              </div>

              <div className="border-t border-gray-200 my-2 pt-2">
                <h3 className="font-medium text-gray-700 mb-2">Address</h3>
                
                <div className="flex gap-2">
                  <MapPin className="h-5 w-5 text-[#6B8E23] mt-0.5 flex-shrink-0" />
                  <div>
                    {employee.address ? (
                      <div>{employee.address}</div>
                    ) : (
                      employee.village || employee.mandal || employee.district || employee.state ? (
                        <div className="space-y-1">
                          {employee.village && employee.village !== "Unknown" && <div>Village: {employee.village}</div>}
                          {employee.mandal && employee.mandal !== "Unknown" && <div>Mandal: {employee.mandal}</div>}
                          {employee.district && employee.district !== "Unknown" && <div>District: {employee.district}</div>}
                          {employee.state && employee.state !== "Unknown" && <div>State: {employee.state}</div>}
                          
                          {!employee.village && !employee.mandal && !employee.district && !employee.state && (
                            <span>Address information not available</span>
                          )}
                          {(employee.village === "Unknown" && employee.mandal === "Unknown" && 
                            employee.district === "Unknown" && employee.state === "Unknown") && (
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

export default EmployeeDetailsPopup; 