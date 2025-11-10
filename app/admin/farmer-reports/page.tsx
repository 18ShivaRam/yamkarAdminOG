"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Download } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { supabase } from "@/lib/supabaseClient"
import { startOfMonth, endOfMonth, format } from "date-fns"

interface FarmerCollection {
  id: string
  created_at: string
  name: string
  mobile_number: string
  email: string
  crop: {
    name: string
  }
  state: {
    state_name: string
  }
  district: {
    district_name: string
  }
  mandal: {
    mandal_name: string
  }
  village: {
    name: string
  }
  social_media: string
  collected_by: {
    name: string
    cadre: {
      name: string
    }
  }
}

export default function FarmerReports() {
  const { user } = useAuth()
  const [fromDate, setFromDate] = useState<Date>(startOfMonth(new Date()))
  const [toDate, setToDate] = useState<Date>(endOfMonth(new Date()))
  const [collections, setCollections] = useState<FarmerCollection[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    fetchFarmerCollections()
  }, [fromDate, toDate])

  const fetchFarmerCollections = async () => {
    if (!user) return
    setIsLoading(true)

    try {
      const { data, error } = await supabase
        .from('farmers')
        .select(`
          id,
          created_at,
          name,
          mobile_number,
          email,
          crop:crops(name),
          state:states(state_name),
          district:districts(district_name),
          mandal:mandals(mandal_name),
          village:villages(name),
          social_media,
          collected_by:users(
            name,
            cadre:cadres(name)
          )
        `)
        .gte('created_at', fromDate.toISOString())
        .lte('created_at', toDate.toISOString())
        .order('created_at', { ascending: false })

      if (error) {
        console.error("Error fetching farmer collections:", error)
        return
      }

      setCollections(data || [])
    } catch (error) {
      console.error("Error fetching farmer collections:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const exportToCSV = () => {
    const headers = [
      "Collection Date",
      "Collection Time",
      "Farmer Name",
      "Mobile Number",
      "Email",
      "Crop",
      "State",
      "District",
      "Mandal",
      "Village",
      "Social Media",
      "Collected By",
      "Collector Cadre"
    ]

    const csvData = collections.map(collection => ({
      "Collection Date": format(new Date(collection.created_at), "dd-MM-yyyy"),
      "Collection Time": format(new Date(collection.created_at), "HH:mm"),
      "Farmer Name": collection.name || "N/A",
      "Mobile Number": collection.mobile_number || "N/A",
      "Email": collection.email || "N/A",
      "Crop": collection.crop?.name || "N/A",
      "State": collection.state?.state_name || "N/A",
      "District": collection.district?.district_name || "N/A",
      "Mandal": collection.mandal?.mandal_name || "N/A",
      "Village": collection.village?.name || "N/A",
      "Social Media": collection.social_media || "N/A",
      "Collected By": collection.collected_by?.name || "N/A",
      "Collector Cadre": collection.collected_by?.cadre?.name || "N/A"
    }))

    const csvContent = [
      headers.join(","),
      ...csvData.map(row => 
        Object.values(row).map(value => 
          String(value).includes(",") ? `"${String(value).replace(/"/g, '""')}"` : value
        ).join(",")
      )
    ].join("\n")

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `farmer_collections_${format(fromDate, 'dd-MM-yyyy')}_to_${format(toDate, 'dd-MM-yyyy')}.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#228B22]">Farmer Data Collections</h1>
        <p className="text-[#6B8E23]">View and export farmer data collection reports</p>
      </div>

      <Card className="bg-[#F4A460] bg-opacity-20">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium mb-1 block">From Date</label>
              <Input
                type="date"
                value={format(fromDate, "yyyy-MM-dd")}
                onChange={(e) => setFromDate(new Date(e.target.value))}
                className="bg-white"
              />
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium mb-1 block">To Date</label>
              <Input
                type="date"
                value={format(toDate, "yyyy-MM-dd")}
                onChange={(e) => setToDate(new Date(e.target.value))}
                className="bg-white"
              />
            </div>
            <div className="flex items-end">
              <Button 
                onClick={exportToCSV}
                className="bg-[#228B22] hover:bg-[#1a6b1a] text-white"
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap text-xs md:text-sm font-medium">Collection Date</TableHead>
                  <TableHead className="whitespace-nowrap text-xs md:text-sm font-medium">Collection Time</TableHead>
                  <TableHead className="whitespace-nowrap text-xs md:text-sm font-medium">Farmer Name</TableHead>
                  <TableHead className="whitespace-nowrap text-xs md:text-sm font-medium">Mobile Number</TableHead>
                  <TableHead className="whitespace-nowrap text-xs md:text-sm font-medium">Email</TableHead>
                  <TableHead className="whitespace-nowrap text-xs md:text-sm font-medium">Crop</TableHead>
                  <TableHead className="whitespace-nowrap text-xs md:text-sm font-medium">State</TableHead>
                  <TableHead className="whitespace-nowrap text-xs md:text-sm font-medium">District</TableHead>
                  <TableHead className="whitespace-nowrap text-xs md:text-sm font-medium">Mandal</TableHead>
                  <TableHead className="whitespace-nowrap text-xs md:text-sm font-medium">Village</TableHead>
                  <TableHead className="whitespace-nowrap text-xs md:text-sm font-medium">Social Media</TableHead>
                  <TableHead className="whitespace-nowrap text-xs md:text-sm font-medium">Collected By</TableHead>
                  <TableHead className="whitespace-nowrap text-xs md:text-sm font-medium">Collector Cadre</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {collections.map((collection) => (
                  <TableRow key={collection.id}>
                    <TableCell className="text-xs md:text-sm">{format(new Date(collection.created_at), "dd-MM-yyyy")}</TableCell>
                    <TableCell className="text-xs md:text-sm">{format(new Date(collection.created_at), "HH:mm")}</TableCell>
                    <TableCell className="text-xs md:text-sm">{collection.name || "N/A"}</TableCell>
                    <TableCell className="text-xs md:text-sm">{collection.mobile_number || "N/A"}</TableCell>
                    <TableCell className="text-xs md:text-sm">{collection.email || "N/A"}</TableCell>
                    <TableCell className="text-xs md:text-sm">{collection.crop?.name || "N/A"}</TableCell>
                    <TableCell className="text-xs md:text-sm">{collection.state?.state_name || "N/A"}</TableCell>
                    <TableCell className="text-xs md:text-sm">{collection.district?.district_name || "N/A"}</TableCell>
                    <TableCell className="text-xs md:text-sm">{collection.mandal?.mandal_name || "N/A"}</TableCell>
                    <TableCell className="text-xs md:text-sm">{collection.village?.name || "N/A"}</TableCell>
                    <TableCell className="text-xs md:text-sm">{collection.social_media || "N/A"}</TableCell>
                    <TableCell className="text-xs md:text-sm">{collection.collected_by?.name || "N/A"}</TableCell>
                    <TableCell className="text-xs md:text-sm">{collection.collected_by?.cadre?.name || "N/A"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 