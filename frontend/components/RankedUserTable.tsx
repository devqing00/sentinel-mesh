"use client";

import { useState } from "react";
import {
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  AlertTriangle,
  CheckCircle,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import UserDetailModal from "@/components/UserDetailModal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface UserRisk {
  user_id: string;
  phase1_risk: number;
  phase2_risk: number;
  trajectory_shift: number;
  category: string;
  top_geo: string | null;
  vitals_anomalies_p2: number;
  contacts_p2: number;
}

export default function RankedUserTable({ 
  data, 
  limit, 
  hideControls 
}: { 
  data: UserRisk[], 
  limit?: number, 
  hideControls?: boolean 
}) {
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState<UserRisk | null>(null);

  const ITEMS_PER_PAGE = limit || 10;

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "escalating":
        return <ArrowUpRight className="w-3.5 h-3.5 text-red-500" />;
      case "persistently-high":
        return <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />;
      case "recovering":
        return <ArrowDownRight className="w-3.5 h-3.5 text-emerald-500" />;
      case "low-risk":
        return <CheckCircle className="w-3.5 h-3.5 text-gray-400" />;
      default:
        return <Minus className="w-3.5 h-3.5 text-blue-500" />;
    }
  };

  const getCategoryBadgeClass = (category: string) => {
    switch (category) {
      case "escalating":
        return "bg-red-50 text-red-600 border-red-100";
      case "persistently-high":
        return "bg-amber-50 text-amber-600 border-amber-100";
      case "recovering":
        return "bg-emerald-50 text-emerald-600 border-emerald-100";
      case "low-risk":
        return "bg-gray-50 text-gray-400 border-gray-200";
      default:
        return "bg-blue-50 text-blue-600 border-blue-100";
    }
  };

  const filteredData = data.filter((u) => {
    const matchesFilter = filter === "all" || u.category === filter;
    const matchesSearch =
      u.user_id.toLowerCase().includes(search.toLowerCase()) ||
      (u.top_geo &&
        u.top_geo.toLowerCase().includes(search.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

  const totalPages = Math.ceil(filteredData.length / ITEMS_PER_PAGE);
  const displayData = filteredData.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE
  );

  return (
    <div className="flex flex-col space-y-4">
      {!hideControls && (
        <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            type="text"
            placeholder="Search users or geo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-white border-gray-200 focus-visible:ring-blue-500 text-sm"
          />
        </div>
        <Select value={filter} onValueChange={(val) => setFilter(val || "all")}>
          <SelectTrigger className="w-[180px] bg-white border-gray-200 focus:ring-blue-500 text-sm">
            <SelectValue placeholder="All Trajectories" />
          </SelectTrigger>
          <SelectContent className="bg-white border-gray-200">
            <SelectItem value="all">All Trajectories</SelectItem>
            <SelectItem value="escalating">Escalating</SelectItem>
            <SelectItem value="persistently-high">
              Persistently High
            </SelectItem>
            <SelectItem value="recovering">Recovering</SelectItem>
            <SelectItem value="stable">Stable</SelectItem>
            <SelectItem value="low-risk">Low Risk</SelectItem>
          </SelectContent>
        </Select>
      </div>
      )}

      <div className={`rounded-xl border border-gray-200 overflow-auto ${!hideControls ? 'max-h-[400px]' : ''}`}>
        <Table>
          <TableHeader className="bg-gray-50/80 sticky top-0">
            <TableRow className="border-gray-200 hover:bg-transparent">
              <TableHead className="font-medium text-gray-500 text-xs">
                User ID
              </TableHead>
              <TableHead className="font-medium text-gray-500 text-xs">
                Top Geo
              </TableHead>
              <TableHead className="font-medium text-gray-500 text-xs">
                Baseline Risk
              </TableHead>
              <TableHead className="font-medium text-gray-500 text-xs">
                Current Risk
              </TableHead>
              <TableHead className="font-medium text-gray-500 text-xs">
                Trajectory
              </TableHead>
              <TableHead className="font-medium text-gray-500 text-xs">
                Category
              </TableHead>
              <TableHead className="font-medium text-gray-500 text-xs text-right">
                Risk Driver
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayData.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="h-24 text-center text-gray-400"
                >
                  No users found matching filters.
                </TableCell>
              </TableRow>
            ) : (
              displayData.map((u) => (
                <TableRow
                  key={u.user_id}
                  onClick={() => setSelectedUser(u)}
                  className="hover:bg-blue-50/30 border-gray-100 transition-colors cursor-pointer group"
                >
                  <TableCell className="font-mono text-sm font-medium text-gray-900">
                    {u.user_id}
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {u.top_geo || "—"}
                  </TableCell>
                  <TableCell className="font-mono text-sm text-gray-500">
                    {u.phase1_risk.toFixed(1)}
                  </TableCell>
                  <TableCell
                    className="font-mono text-sm font-semibold"
                    style={{
                      color: u.phase2_risk >= 70 ? "#EF4444" : "#1F2937",
                    }}
                  >
                    {u.phase2_risk.toFixed(1)}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    <div className="flex items-center gap-1.5">
                      {getCategoryIcon(u.category)}
                      <span
                        style={{
                          color:
                            u.trajectory_shift > 0
                              ? "#EF4444"
                              : u.trajectory_shift < 0
                              ? "#10B981"
                              : "#9CA3AF",
                        }}
                      >
                        {u.trajectory_shift > 0 ? "+" : ""}
                        {u.trajectory_shift.toFixed(1)}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium capitalize border ${getCategoryBadgeClass(
                        u.category
                      )}`}
                    >
                      {u.category.replace("-", " ")}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    {u.vitals_anomalies_p2 > 0 ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-100 uppercase tracking-wider">
                        Symptoms
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-100 uppercase tracking-wider">
                        High Exposure
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-gray-500 font-medium">
            Showing {(page - 1) * ITEMS_PER_PAGE + 1} to {Math.min(page * ITEMS_PER_PAGE, filteredData.length)} of {filteredData.length} entries
          </p>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="h-8 w-8 p-0 rounded-full"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-xs font-bold text-gray-700">
              Page {page} of {totalPages}
            </span>
            <Button 
              variant="outline" 
              size="sm" 
              className="h-8 w-8 p-0 rounded-full"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {selectedUser && (
        <UserDetailModal
          userId={selectedUser.user_id}
          rankEntry={selectedUser}
          onClose={() => setSelectedUser(null)}
        />
      )}
    </div>
  );
}
