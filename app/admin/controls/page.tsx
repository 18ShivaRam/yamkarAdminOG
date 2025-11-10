"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table"
import { Separator } from "@/components/ui/separator"
import { Loader2, Settings, Plus, Pencil, ArrowUpDown, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { supabase } from "@/lib/supabaseClient"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default function AdminControlsPage() {
  const { user } = useAuth()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [activeTab, setActiveTab] = useState("crops")
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 50

  // Sorting state (per active tab)
  const [sortKey, setSortKey] = useState<string>("")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc")
    } else {
      setSortKey(key)
      setSortDir("asc")
    }
  }

  const handleDeleteUser = async (userId: string | number) => {
    const id = String(userId)
    const ok = typeof window !== 'undefined' ? window.confirm('Are you sure you want to delete this user? This will remove their authentication account.') : true
    if (!ok) return
    try {
      setLoading(true)
      const res = await fetch('/api/admin/users/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: id })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Failed to delete user')
      toast({ title: 'User deleted' })
      // refresh lists
      const [usersRes] = await Promise.all([
        supabase.from('users').select('*').order('name')
      ])
      if (usersRes.error) throw usersRes.error
      setUsers(usersRes.data || [])
    } catch (e: any) {
      console.error(e)
      toast({ title: 'Delete failed', description: e?.message || 'Unknown error', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const compareVal = (a: any, b: any) => {
    const sa = (a ?? "").toString().toLowerCase()
    const sb = (b ?? "").toString().toLowerCase()
    return sa.localeCompare(sb)
  }

  const sortRows = (rows: any[], valueGetter: (row: any) => any) => {
    if (!sortKey) return rows
    const sorted = [...rows].sort((r1, r2) => compareVal(valueGetter(r1), valueGetter(r2)))
    return sortDir === "asc" ? sorted : sorted.reverse()
  }

  const SortIcon = ({ active }: { active: boolean }) => (
    active ? (sortDir === "asc" ? <ChevronUp className="h-3.5 w-3.5 ml-1"/> : <ChevronDown className="h-3.5 w-3.5 ml-1"/>) : <ArrowUpDown className="h-3.5 w-3.5 ml-1 text-muted-foreground"/>
  )

  const [crops, setCrops] = useState<any[]>([])
  const [companies, setCompanies] = useState<any[]>([])
  const [cadres, setCadres] = useState<any[]>([])
  const [states, setStates] = useState<any[]>([])
  const [districts, setDistricts] = useState<any[]>([])
  const [mandals, setMandals] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])

  // Loaded flags to avoid unnecessary calls
  const [loaded, setLoaded] = useState({
    crops: false,
    companies: false,
    cadres: false,
    states: false,
    districts: false,
    mandals: false,
    users: false,
  })

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editId, setEditId] = useState<string | number | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Form states per entity
  const [cropForm, setCropForm] = useState({ name: "" })
  const [companyForm, setCompanyForm] = useState({ name: "" })
  const [cadreForm, setCadreForm] = useState({ name: "", shortname: "" })
  const [stateForm, setStateForm] = useState({ state_name: "" })
  const [districtForm, setDistrictForm] = useState({ district_name: "", state_id: "" })
  const [mandalForm, setMandalForm] = useState({ mandal_name: "", district_id: "" })
  const [userForm, setUserForm] = useState({
    name: "",
    email: "",
    role: "employee",
    manager_id: "",
    phone: "",
    cadre: "",
    state: "",
    district: "",
    mandal: "",
  })

  // Individual fetchers
  const fetchCrops = async () => {
    const { data, error } = await supabase.from('crops').select('*').order('name')
    if (error) throw error
    setCrops(data || [])
    setLoaded(prev => ({ ...prev, crops: true }))
  }
  const fetchCompanies = async () => {
    const { data, error } = await supabase.from('companies').select('*').order('name')
    if (error) throw error
    setCompanies(data || [])
    setLoaded(prev => ({ ...prev, companies: true }))
  }
  const fetchCadres = async () => {
    const { data, error } = await supabase.from('cadres').select('*').order('name')
    if (error) throw error
    setCadres(data || [])
    setLoaded(prev => ({ ...prev, cadres: true }))
  }
  const fetchStates = async () => {
    const { data, error } = await supabase.from('states').select('*').order('state_name')
    if (error) throw error
    setStates(data || [])
    setLoaded(prev => ({ ...prev, states: true }))
  }
  const fetchDistricts = async () => {
    const { data, error } = await supabase.from('districts').select('*').order('district_name')
    if (error) throw error
    setDistricts(data || [])
    setLoaded(prev => ({ ...prev, districts: true }))
  }
  const fetchMandals = async () => {
    const { data, error } = await supabase.from('mandals').select('*').order('mandal_name')
    if (error) throw error
    setMandals(data || [])
    setLoaded(prev => ({ ...prev, mandals: true }))
  }
  const fetchUsers = async () => {
    const { data, error } = await supabase.from('users').select('*').eq('is_deleted', false).order('name')
    if (error) throw error
    setUsers(data || [])
    setLoaded(prev => ({ ...prev, users: true }))
  }

  // Helper to fetch minimal deps for a tab
  const fetchForTab = async (tab: string, force = false) => {
    try {
      setLoading(true)
      if (tab === 'crops') {
        if (force || !loaded.crops) await fetchCrops()
      } else if (tab === 'companies') {
        if (force || !loaded.companies) await fetchCompanies()
      } else if (tab === 'cadres') {
        if (force || !loaded.cadres) await fetchCadres()
      } else if (tab === 'states') {
        if (force || !loaded.states) await fetchStates()
      } else if (tab === 'districts') {
        // needs states for name lookup
        if (force || !loaded.districts) await fetchDistricts()
        if (force || !loaded.states) await fetchStates()
      } else if (tab === 'mandals') {
        // needs districts for name lookup
        if (force || !loaded.mandals) await fetchMandals()
        if (force || !loaded.districts) await fetchDistricts()
      } else if (tab === 'users') {
        // needs multiple lookups
        if (force || !loaded.users) await fetchUsers()
        if (force || !loaded.cadres) await fetchCadres()
        if (force || !loaded.states) await fetchStates()
        if (force || !loaded.districts) await fetchDistricts()
        if (force || !loaded.mandals) await fetchMandals()
      }
    } catch (e: any) {
      console.error('Fetch error:', e)
      setError(e.message || 'Failed to load data')
      toast({ title: 'Error', description: e.message || 'Failed to load data', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  // Initial load: only crops
  useEffect(() => {
    fetchForTab('crops')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // On tab change: fetch only needed data
  useEffect(() => {
    fetchForTab(activeTab)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  // Build lookup maps for FK -> name join rendering
  const statesById = useMemo(() => Object.fromEntries(states.map((s: any) => [String(s.id), s.state_name])), [states])
  const districtsById = useMemo(() => Object.fromEntries(districts.map((d: any) => [String(d.id), d.district_name])), [districts])
  const mandalsById = useMemo(() => Object.fromEntries(mandals.map((m: any) => [String(m.id), m.mandal_name])), [mandals])
  const cadresById = useMemo(() => Object.fromEntries(cadres.map((c: any) => [String(c.id), c.name])), [cadres])
  const usersById = useMemo(() => Object.fromEntries(users.map((u: any) => [String(u.id), u.name])), [users])

  const filtered = (rows: any[], fields: string[]) => {
    if (!search) return rows
    const q = search.toLowerCase()
    return rows.filter(r => fields.some(f => String(r[f] ?? "").toLowerCase().includes(q)))
  }

  // Reset pagination when tab or search changes
  useEffect(() => { setPage(0) }, [activeTab, search])

  // Reusable Gmail-style pagination bar
  const PaginationBar = ({ total }: { total: number }) => {
    const start = total === 0 ? 0 : page * PAGE_SIZE + 1
    const end = Math.min(total, (page + 1) * PAGE_SIZE)
    return (
      <div className="flex items-center justify-end gap-2 mb-2">
        <span className="text-sm text-muted-foreground">{total === 0 ? '0 of 0' : `${start}-${end} of ${total}`}</span>
        <Button variant="outline" size="icon" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" onClick={() => setPage(p => p + 1)} disabled={end >= total}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex items-center gap-2 text-[#228B22]">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading admin controls...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-8 text-red-600">{error}</CardContent>
        </Card>
      </div>
    )
  }

  const openAdd = () => {
    setIsEditing(false)
    setEditId(null)
    // reset form for current tab
    if (activeTab === "crops") setCropForm({ name: "" })
    if (activeTab === "companies") setCompanyForm({ name: "" })
    if (activeTab === "cadres") setCadreForm({ name: "", shortname: "" })
    if (activeTab === "states") setStateForm({ state_name: "" })
    if (activeTab === "districts") setDistrictForm({ district_name: "", state_id: "" })
    if (activeTab === "mandals") setMandalForm({ mandal_name: "", district_id: "" })
    if (activeTab === "users") setUserForm({ name: "", email: "", role: "employee", manager_id: "", phone: "", cadre: "", state: "", district: "", mandal: "" })
    setShowModal(true)
  }

  const openEdit = (row: any) => {
    setIsEditing(true)
    setEditId(row.id)
    if (activeTab === "crops") setCropForm({ name: row.name || "" })
    if (activeTab === "companies") setCompanyForm({ name: row.name || "" })
    if (activeTab === "cadres") setCadreForm({ name: row.name || "", shortname: row.shortname || "" })
    if (activeTab === "states") setStateForm({ state_name: row.state_name || "" })
    if (activeTab === "districts") setDistrictForm({ district_name: row.district_name || "", state_id: String(row.state_id || "") })
    if (activeTab === "mandals") setMandalForm({ mandal_name: row.mandal_name || "", district_id: String(row.district_id || "") })
    if (activeTab === "users") setUserForm({
      name: row.name || "",
      email: row.email || "",
      role: row.role || "employee",
      manager_id: String(row.manager_id || ""),
      phone: row.phone || row.phone_number || "",
      cadre: String(row.cadre || ""),
      state: String(row.state || ""),
      district: String(row.district || ""),
      mandal: String(row.mandal || ""),
    })
    setShowModal(true)
  }

  const afterSave = async (message: string) => {
    toast({ title: 'Success', description: message })
    setShowModal(false)
    await fetchForTab(activeTab, true)
  }

  const handleSave = async () => {
    try {
      setIsSaving(true)
      if (activeTab === "crops") {
        if (isEditing && editId) {
          const { error } = await supabase.from("crops").update({ name: cropForm.name }).eq("id", editId)
          if (error) throw error
          return afterSave("Crop updated")
        } else {
          const { error } = await supabase.from("crops").insert({ name: cropForm.name })
          if (error) throw error
          return afterSave("Crop added")
        }
      }
      if (activeTab === "companies") {
        if (isEditing && editId) {
          const { error } = await supabase.from("companies").update({ name: companyForm.name }).eq("id", editId)
          if (error) throw error
          return afterSave("Company updated")
        } else {
          // Some schemas require client-provided id (no default). Use UUID to satisfy NOT NULL id
          const payload: any = { name: companyForm.name }
          try {
            // Provide an id if the table requires it
            payload.id = crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}`
          } catch {}
          const { error } = await supabase.from("companies").insert(payload)
          if (error) throw error
          return afterSave("Company added")
        }
      }
      if (activeTab === "cadres") {
        if (isEditing && editId) {
          const { error } = await supabase.from("cadres").update({ name: cadreForm.name, shortname: cadreForm.shortname }).eq("id", editId)
          if (error) throw error
          return afterSave("Cadre updated")
        } else {
          const { error } = await supabase.from("cadres").insert({ name: cadreForm.name, shortname: cadreForm.shortname })
          if (error) throw error
          return afterSave("Cadre added")
        }
      }
      if (activeTab === "states") {
        if (isEditing && editId) {
          const { error } = await supabase.from("states").update({ state_name: stateForm.state_name }).eq("id", editId)
          if (error) throw error
          return afterSave("State updated")
        } else {
          const payload: any = { state_name: stateForm.state_name }
          try {
            payload.id = crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}`
          } catch {}
          const { error } = await supabase.from("states").insert(payload)
          if (error) throw error
          return afterSave("State added")
        }
      }
      if (activeTab === "districts") {
        if (!districtForm.state_id) {
          toast({ title: "Missing state", description: "Please select a State before saving the District.", variant: "destructive" })
          return
        }
        const payload = { district_name: districtForm.district_name, state_id: districtForm.state_id }
        if (isEditing && editId) {
          const { error } = await supabase.from("districts").update(payload).eq("id", editId)
          if (error) throw error
          return afterSave("District updated")
        } else {
          const { error } = await supabase.from("districts").insert(payload)
          if (error) throw error
          return afterSave("District added")
        }
      }
      if (activeTab === "mandals") {
        if (!mandalForm.district_id) {
          toast({ title: "Missing district", description: "Please select a District before saving the Mandal.", variant: "destructive" })
          return
        }
        const payload = { mandal_name: mandalForm.mandal_name, district_id: mandalForm.district_id }
        if (isEditing && editId) {
          const { error } = await supabase.from("mandals").update(payload).eq("id", editId)
          if (error) throw error
          return afterSave("Mandal updated")
        } else {
          const { error } = await supabase.from("mandals").insert(payload)
          if (error) throw error
          return afterSave("Mandal added")
        }
      }
      if (activeTab === "users") {
        const payload: any = {
          name: userForm.name,
          email: userForm.email,
          role: userForm.role,
          manager_id: userForm.manager_id ? userForm.manager_id : null,
          phone: userForm.phone || null,
          cadre: userForm.cadre || null,
          state: userForm.state || null,
          district: userForm.district || null,
          mandal: userForm.mandal || null,
        }
        if (isEditing && editId) {
          const { error } = await supabase.from("users").update(payload).eq("id", editId)
          if (error) throw error
          return afterSave("User updated")
        } else {
          const { error } = await supabase.from("users").insert(payload)
          if (error) throw error
          return afterSave("User added")
        }
      }
    } catch (e: any) {
      console.error(e)
      const desc = e?.message || e?.details || e?.hint || JSON.stringify(e)
      toast({ title: "Save failed", description: desc, variant: "destructive" })
    } finally {
      setIsSaving(false)
    }
  }

  const filteredDistrictsByState = (sid: string) => districts.filter((d: any) => String(d.state_id) === String(sid))
  const filteredMandalsByDistrict = (did: string) => mandals.filter((m: any) => String(m.district_id) === String(did))

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#228B22] flex items-center gap-2"><Settings className="h-6 w-6"/> Admin Controls</h1>
          <p className="text-sm text-muted-foreground">View master data and users</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-full max-w-xs">
            <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          {activeTab !== "users" && (
            <Button onClick={openAdd} className="bg-[#228B22] hover:bg-[#1a6b1a]">
              <Plus className="h-4 w-4 mr-1" /> Add {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Master Data</CardTitle>
        </CardHeader>
        <Separator />
        <CardContent className="pt-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="flex flex-wrap gap-2">
              <TabsTrigger value="crops">Crops</TabsTrigger>
              <TabsTrigger value="companies">Companies</TabsTrigger>
              <TabsTrigger value="cadres">Cadres</TabsTrigger>
              <TabsTrigger value="users">Users</TabsTrigger>
              <TabsTrigger value="states">States</TabsTrigger>
              <TabsTrigger value="districts">Districts</TabsTrigger>
              <TabsTrigger value="mandals">Mandals</TabsTrigger>
            </TabsList>

            <TabsContent value="crops" className="mt-6 overflow-auto">
              <PaginationBar total={filtered(crops, ["name"]).length} />
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <button className="inline-flex items-center" onClick={() => toggleSort("name")}>
                        Name <SortIcon active={sortKey === "name"} />
                      </button>
                    </TableHead>
                    <TableHead className="w-24">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortRows(filtered(crops, ["name"]), (r) => r.name)
                    .slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
                    .map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.name}</TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" onClick={() => openEdit(r)} className="gap-1">
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="companies" className="mt-6 overflow-auto">
              <PaginationBar total={filtered(companies, ["name"]).length} />
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <button className="inline-flex items-center" onClick={() => toggleSort("name")}>
                        Name <SortIcon active={sortKey === "name"} />
                      </button>
                    </TableHead>
                    <TableHead className="w-24">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortRows(filtered(companies, ["name"]), (r) => r.name)
                    .slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
                    .map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.name}</TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" onClick={() => openEdit(r)} className="gap-1">
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="cadres" className="mt-6 overflow-auto">
              <PaginationBar total={filtered(cadres, ["name", "shortname"]).length} />
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <button className="inline-flex items-center" onClick={() => toggleSort("name")}>
                        Name <SortIcon active={sortKey === "name"} />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button className="inline-flex items-center" onClick={() => toggleSort("shortname")}>
                        Short Name <SortIcon active={sortKey === "shortname"} />
                      </button>
                    </TableHead>
                    <TableHead className="w-24">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortRows(filtered(cadres, ["name", "shortname"]), (r) => sortKey === "shortname" ? r.shortname : r.name)
                    .slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
                    .map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.name}</TableCell>
                      <TableCell>{r.shortname}</TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" onClick={() => openEdit(r)} className="gap-1">
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="users" className="mt-6 overflow-auto">
              <PaginationBar total={filtered(users, ["name", "email", "role", "phone"]).length} />
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead><button className="inline-flex items-center" onClick={() => toggleSort("name")}>Name <SortIcon active={sortKey === "name"} /></button></TableHead>
                    <TableHead><button className="inline-flex items-center" onClick={() => toggleSort("email")}>Email <SortIcon active={sortKey === "email"} /></button></TableHead>
                    <TableHead><button className="inline-flex items-center" onClick={() => toggleSort("role")}>Role <SortIcon active={sortKey === "role"} /></button></TableHead>
                    <TableHead><button className="inline-flex items-center" onClick={() => toggleSort("manager_name")}>Manager <SortIcon active={sortKey === "manager_name"} /></button></TableHead>
                    <TableHead><button className="inline-flex items-center" onClick={() => toggleSort("phone")}>Phone <SortIcon active={sortKey === "phone"} /></button></TableHead>
                    <TableHead><button className="inline-flex items-center" onClick={() => toggleSort("cadre_name")}>Cadre <SortIcon active={sortKey === "cadre_name"} /></button></TableHead>
                    <TableHead><button className="inline-flex items-center" onClick={() => toggleSort("state_name")}>State <SortIcon active={sortKey === "state_name"} /></button></TableHead>
                    <TableHead><button className="inline-flex items-center" onClick={() => toggleSort("district_name")}>District <SortIcon active={sortKey === "district_name"} /></button></TableHead>
                    <TableHead><button className="inline-flex items-center" onClick={() => toggleSort("mandal_name")}>Mandal <SortIcon active={sortKey === "mandal_name"} /></button></TableHead>
                    <TableHead className="w-24">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortRows(filtered(users, ["name", "email", "role", "phone"]), (u) => {
                    switch (sortKey) {
                      case "name": return u.name
                      case "email": return u.email
                      case "role": return u.role
                      case "manager_name": return usersById[String(u.manager_id)]
                      case "phone": return u.phone || u.phone_number
                      case "cadre_name": return cadresById[String(u.cadre)]
                      case "state_name": return statesById[String(u.state)]
                      case "district_name": return districtsById[String(u.district)]
                      case "mandal_name": return mandalsById[String(u.mandal)]
                      default: return ""
                    }
                  })
                    .slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
                    .map((u: any) => (
                    <TableRow key={u.id}>
                      <TableCell>{u.name}</TableCell>
                      <TableCell>{u.email}</TableCell>
                      <TableCell>{u.role}</TableCell>
                      <TableCell>{usersById[String(u.manager_id)] || "-"}</TableCell>
                      <TableCell>{u.phone || u.phone_number || "-"}</TableCell>
                      <TableCell>{cadresById[String(u.cadre)] || "-"}</TableCell>
                      <TableCell>{statesById[String(u.state)] || "-"}</TableCell>
                      <TableCell>{districtsById[String(u.district)] || "-"}</TableCell>
                      <TableCell>{mandalsById[String(u.mandal)] || "-"}</TableCell>
                      <TableCell className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => openEdit(u)} className="gap-1">
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => handleDeleteUser(u.id)}>
                          Delete
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="states" className="mt-6 overflow-auto">
              <PaginationBar total={filtered(states, ["state_name"]).length} />
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <button className="inline-flex items-center" onClick={() => toggleSort("state_name")}>
                        State Name <SortIcon active={sortKey === "state_name"} />
                      </button>
                    </TableHead>
                    <TableHead className="w-24">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortRows(filtered(states, ["state_name"]), (s) => s.state_name)
                    .slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
                    .map((s: any) => (
                    <TableRow key={s.id}>
                      <TableCell>{s.state_name}</TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" onClick={() => openEdit(s)} className="gap-1">
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="districts" className="mt-6 overflow-auto">
              <PaginationBar total={filtered(districts, ["district_name"]).length} />
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <button className="inline-flex items-center" onClick={() => toggleSort("district_name")}>
                        District Name <SortIcon active={sortKey === "district_name"} />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button className="inline-flex items-center" onClick={() => toggleSort("state_name")}>
                        State Name <SortIcon active={sortKey === "state_name"} />
                      </button>
                    </TableHead>
                    <TableHead className="w-24">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortRows(filtered(districts, ["district_name"]), (d) => sortKey === "state_name" ? statesById[String(d.state_id)] : d.district_name)
                    .slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
                    .map((d: any) => (
                    <TableRow key={d.id}>
                      <TableCell>{d.district_name}</TableCell>
                      <TableCell>{statesById[String(d.state_id)] || "-"}</TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" onClick={() => openEdit(d)} className="gap-1">
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="mandals" className="mt-6 overflow-auto">
              <PaginationBar total={filtered(mandals, ["mandal_name"]).length} />
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <button className="inline-flex items-center" onClick={() => toggleSort("mandal_name")}>
                        Mandal Name <SortIcon active={sortKey === "mandal_name"} />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button className="inline-flex items-center" onClick={() => toggleSort("district_name")}>
                        District Name <SortIcon active={sortKey === "district_name"} />
                      </button>
                    </TableHead>
                    <TableHead className="w-24">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortRows(filtered(mandals, ["mandal_name"]), (m) => sortKey === "district_name" ? districtsById[String(m.district_id)] : m.mandal_name)
                    .slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
                    .map((m: any) => (
                    <TableRow key={m.id}>
                      <TableCell>{m.mandal_name}</TableCell>
                      <TableCell>{districtsById[String(m.district_id)] || "-"}</TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" onClick={() => openEdit(m)} className="gap-1">
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Add/Edit Modal */}
      <Dialog open={showModal} onOpenChange={(o) => !o && setShowModal(false)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edit" : "Add"} {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</DialogTitle>
          </DialogHeader>

          {/* CROPS */}
          {activeTab === "crops" && (
            <div className="space-y-3">
              <Label>Name</Label>
              <Input value={cropForm.name} onChange={(e) => setCropForm({ name: e.target.value })} />
            </div>
          )}

          {/* COMPANIES */}
          {activeTab === "companies" && (
            <div className="space-y-3">
              <Label>Name</Label>
              <Input value={companyForm.name} onChange={(e) => setCompanyForm({ name: e.target.value })} />
            </div>
          )}

          {/* CADRES */}
          {activeTab === "cadres" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={cadreForm.name} onChange={(e) => setCadreForm({ ...cadreForm, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Short Name</Label>
                <Input value={cadreForm.shortname} onChange={(e) => setCadreForm({ ...cadreForm, shortname: e.target.value })} />
              </div>
            </div>
          )}

          {/* STATES */}
          {activeTab === "states" && (
            <div className="space-y-3">
              <Label>State Name</Label>
              <Input value={stateForm.state_name} onChange={(e) => setStateForm({ state_name: e.target.value })} />
            </div>
          )}

          {/* DISTRICTS */}
          {activeTab === "districts" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>District Name</Label>
                <Input value={districtForm.district_name} onChange={(e) => setDistrictForm({ ...districtForm, district_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>State</Label>
                <Select value={districtForm.state_id} onValueChange={(v) => setDistrictForm({ ...districtForm, state_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger>
                  <SelectContent>
                    {states.map((s: any) => (
                      <SelectItem key={s.id} value={String(s.id)}>{s.state_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* MANDALS */}
          {activeTab === "mandals" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Mandal Name</Label>
                <Input value={mandalForm.mandal_name} onChange={(e) => setMandalForm({ ...mandalForm, mandal_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>District</Label>
                <Select value={mandalForm.district_id} onValueChange={(v) => setMandalForm({ ...mandalForm, district_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select district" /></SelectTrigger>
                  <SelectContent>
                    {districts.map((d: any) => (
                      <SelectItem key={d.id} value={String(d.id)}>{d.district_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* USERS */}
          {activeTab === "users" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={userForm.email} readOnly disabled className="opacity-80 cursor-not-allowed" />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={userForm.role} onValueChange={(v) => setUserForm({ ...userForm, role: v })}>
                  <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">admin</SelectItem>
                    <SelectItem value="manager">manager</SelectItem>
                    <SelectItem value="employee">employee</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Manager</Label>
                <Select value={userForm.manager_id} onValueChange={(v) => setUserForm({ ...userForm, manager_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select manager" /></SelectTrigger>
                  <SelectContent>
                    {users.map((u: any) => (
                      <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={userForm.phone} readOnly disabled className="opacity-80 cursor-not-allowed" />
              </div>
              <div className="space-y-2">
                <Label>Cadre</Label>
                <Select value={userForm.cadre} onValueChange={(v) => setUserForm({ ...userForm, cadre: v })}>
                  <SelectTrigger><SelectValue placeholder="Select cadre" /></SelectTrigger>
                  <SelectContent>
                    {cadres.map((c: any) => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>State</Label>
                <Select value={userForm.state} onValueChange={(v) => setUserForm({ ...userForm, state: v, district: "", mandal: "" })}>
                  <SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger>
                  <SelectContent>
                    {states.map((s: any) => (
                      <SelectItem key={s.id} value={String(s.id)}>{s.state_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>District</Label>
                <Select value={userForm.district} onValueChange={(v) => setUserForm({ ...userForm, district: v, mandal: "" })}>
                  <SelectTrigger><SelectValue placeholder="Select district" /></SelectTrigger>
                  <SelectContent>
                    {filteredDistrictsByState(userForm.state).map((d: any) => (
                      <SelectItem key={d.id} value={String(d.id)}>{d.district_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Mandal</Label>
                <Select value={userForm.mandal} onValueChange={(v) => setUserForm({ ...userForm, mandal: v })}>
                  <SelectTrigger><SelectValue placeholder="Select mandal" /></SelectTrigger>
                  <SelectContent>
                    {filteredMandalsByDistrict(userForm.district).map((m: any) => (
                      <SelectItem key={m.id} value={String(m.id)}>{m.mandal_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setShowModal(false)} disabled={isSaving}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving} className="bg-[#228B22] hover:bg-[#1a6b1a]">
              {isSaving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin"/>Saving...</> : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

