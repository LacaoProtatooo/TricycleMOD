import { useState, useEffect, useCallback } from "react";
import { Modal } from "../components/ui/modal";
import { useModal } from "../hooks/useModal";
import PageMeta from "../components/common/PageMeta";
import PageBreadcrumb from "../components/common/PageBreadCrumb";
import axios from "axios";
import { getToken } from "../redux/actions/authAction";
import DriverRankingPanel from "../components/DriverRankingPanel";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

// WEBTTODA Rules Categories for filtering
const RULE_CATEGORIES = [
  { id: "I", name: "Work & Drive Efficiency" },
  { id: "II", name: "Act of Dishonesty" },
  { id: "III", name: "Act Against Public Policy" },
  { id: "IV", name: "Serious Offenses" },
  { id: "V", name: "Repeated Violations" },
];

// Penalty action badges
const PENALTY_BADGES = {
  warning: { label: "Warning", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
  suspension: { label: "Suspension", color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400" },
  dismissal: { label: "Dismissal", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
};

// Status badges
const STATUS_BADGES = {
  pending: { label: "Pending", color: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300" },
  confirmed: { label: "Confirmed", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
  appealed: { label: "Appealed", color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400" },
  overturned: { label: "Overturned", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  served: { label: "Served", color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
};

const Violations = () => {
  // State
  const [violations, setViolations] = useState([]);
  const [stats, setStats] = useState(null);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedViolation, setSelectedViolation] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  
  // Create violation form
  const [createForm, setCreateForm] = useState({
    driverId: "",
    ruleNumber: "",
    description: "",
    incidentDate: new Date().toISOString().split("T")[0],
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [driverSearch, setDriverSearch] = useState("");
  const [driverResults, setDriverResults] = useState([]);
  const [searchingDrivers, setSearchingDrivers] = useState(false);
  
  // Appeal form
  const [appealForm, setAppealForm] = useState({
    decision: "",
    notes: "",
    reducedDays: 0,
  });
  const [appealLoading, setAppealLoading] = useState(false);
  
  // Modals
  const { isOpen: isDetailsOpen, openModal: openDetailsModal, closeModal: closeDetailsModal } = useModal();
  const { isOpen: isCreateOpen, openModal: openCreateModal, closeModal: closeCreateModal } = useModal();
  const { isOpen: isAppealOpen, openModal: openAppealModal, closeModal: closeAppealModal } = useModal();
  const { isOpen: isRulesOpen, openModal: openRulesModal, closeModal: closeRulesModal } = useModal();

  // Fetch violations
  const fetchViolations = useCallback(async () => {
    setLoading(true);
    try {
      const token = getToken();
      const params = new URLSearchParams({
        page: currentPage,
        limit: 20,
      });
      
      if (actionFilter) params.append("action", actionFilter);
      if (statusFilter) params.append("status", statusFilter);
      if (categoryFilter) params.append("category", categoryFilter);
      
      const response = await axios.get(`${API_URL}/violations?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      setViolations(response.data.violations);
      setPagination(response.data.pagination);
      setStats(response.data.stats);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to fetch violations");
    } finally {
      setLoading(false);
    }
  }, [currentPage, actionFilter, statusFilter, categoryFilter]);

  // Fetch stats
  const fetchStats = async () => {
    setStatsLoading(true);
    try {
      const token = getToken();
      const response = await axios.get(`${API_URL}/violations/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setStats(response.data.stats);
    } catch (err) {
      console.error("Failed to fetch stats:", err);
    } finally {
      setStatsLoading(false);
    }
  };

  // Fetch rules reference
  const fetchRules = async () => {
    try {
      const token = getToken();
      const response = await axios.get(`${API_URL}/violations/rules`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setRules(response.data.rules);
    } catch (err) {
      console.error("Failed to fetch rules:", err);
    }
  };

  // Fetch violation details
  const fetchViolationDetails = async (id) => {
    setDetailsLoading(true);
    try {
      const token = getToken();
      const response = await axios.get(`${API_URL}/violations/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSelectedViolation(response.data);
      openDetailsModal();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to fetch violation details");
    } finally {
      setDetailsLoading(false);
    }
  };

  // Search drivers
  const searchDrivers = async (query) => {
    if (!query || query.length < 2) {
      setDriverResults([]);
      return;
    }
    
    setSearchingDrivers(true);
    try {
      const token = getToken();
      const response = await axios.get(`${API_URL}/admin/drivers?search=${query}&limit=10`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setDriverResults(response.data.drivers || []);
    } catch (err) {
      console.error("Failed to search drivers:", err);
    } finally {
      setSearchingDrivers(false);
    }
  };

  // Create violation
  const handleCreateViolation = async (e) => {
    e.preventDefault();
    setCreateLoading(true);
    
    try {
      const token = getToken();
      await axios.post(`${API_URL}/violations`, createForm, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      closeCreateModal();
      setCreateForm({
        driverId: "",
        ruleNumber: "",
        description: "",
        incidentDate: new Date().toISOString().split("T")[0],
      });
      setDriverSearch("");
      setDriverResults([]);
      fetchViolations();
      fetchStats();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create violation");
    } finally {
      setCreateLoading(false);
    }
  };

  // Process appeal
  const handleProcessAppeal = async (e) => {
    e.preventDefault();
    if (!selectedViolation) return;
    
    setAppealLoading(true);
    try {
      const token = getToken();
      await axios.put(
        `${API_URL}/violations/${selectedViolation.violation._id}/appeal`,
        appealForm,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      closeAppealModal();
      setAppealForm({ decision: "", notes: "", reducedDays: 0 });
      fetchViolationDetails(selectedViolation.violation._id);
      fetchViolations();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to process appeal");
    } finally {
      setAppealLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchViolations();
    fetchStats();
    fetchRules();
  }, []);

  // Refetch when filters change
  useEffect(() => {
    fetchViolations();
  }, [fetchViolations]);

  // Driver search debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      searchDrivers(driverSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [driverSearch]);

  // Format date
  const formatDate = (date) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Get ordinal suffix
  const getOrdinalSuffix = (num) => {
    const j = num % 10;
    const k = num % 100;
    if (j === 1 && k !== 11) return "st";
    if (j === 2 && k !== 12) return "nd";
    if (j === 3 && k !== 13) return "rd";
    return "th";
  };

  return (
    <>
      <PageMeta
        title="Violations Management | TricycleMOD Admin"
        description="Manage driver violations and WEBTTODA rules enforcement"
      />
      <PageBreadcrumb pageTitle="Violations Management" />

      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/30">
                <svg className="h-6 w-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Violations</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats?.total || 0}</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-yellow-100 dark:bg-yellow-900/30">
                <svg className="h-6 w-6 text-yellow-600 dark:text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Warnings</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats?.byAction?.find(a => a._id === "warning")?.count || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-100 dark:bg-orange-900/30">
                <svg className="h-6 w-6 text-orange-600 dark:text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Suspensions</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats?.byAction?.find(a => a._id === "suspension")?.count || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-100 dark:bg-red-900/30">
                <svg className="h-6 w-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Dismissals</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats?.byAction?.find(a => a._id === "dismissal")?.count || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100 dark:bg-purple-900/30">
                <svg className="h-6 w-6 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Pending Appeals</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats?.pendingAppeals || 0}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Driver Violation Ranking */}
        <DriverRankingPanel type="violations" limit={10} />

        {/* Actions Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Action Filter */}
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            >
              <option value="">All Actions</option>
              <option value="warning">Warnings</option>
              <option value="suspension">Suspensions</option>
              <option value="dismissal">Dismissals</option>
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="appealed">Appealed</option>
              <option value="overturned">Overturned</option>
              <option value="served">Served</option>
            </select>

            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            >
              <option value="">All Categories</option>
              {RULE_CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={openRulesModal}
              className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              WEBTTODA Rules
            </button>

            <button
              onClick={openCreateModal}
              className="flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Record Violation
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="rounded-lg bg-red-50 p-4 dark:bg-red-900/20">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            <button
              onClick={() => setError(null)}
              className="mt-2 text-sm font-medium text-red-600 underline hover:no-underline dark:text-red-400"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Violations Table */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">Driver</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">Rule</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">Offense</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">Penalty</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">Status</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">Date</th>
                  <th className="px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <svg className="h-5 w-5 animate-spin text-brand-500" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span className="text-gray-500 dark:text-gray-400">Loading violations...</span>
                      </div>
                    </td>
                  </tr>
                ) : violations.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                      No violations found
                    </td>
                  </tr>
                ) : (
                  violations.map((violation) => (
                    <tr
                      key={violation._id}
                      className="cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
                      onClick={() => fetchViolationDetails(violation._id)}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={violation.driver?.image || "/images/user/default-avatar.png"}
                            alt=""
                            className="h-10 w-10 rounded-full object-cover"
                          />
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">
                              {violation.driver?.firstname} {violation.driver?.lastname}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {violation.driver?.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            Rule #{violation.ruleNumber}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">
                            {violation.ruleDetails?.rule}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                          {violation.offenseNumber}{getOrdinalSuffix(violation.offenseNumber)} Offense
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${PENALTY_BADGES[violation.penalty?.action]?.color || "bg-gray-100 text-gray-800"}`}>
                          {violation.penalty?.label || violation.penalty?.action}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGES[violation.status]?.color || "bg-gray-100 text-gray-800"}`}>
                          {STATUS_BADGES[violation.status]?.label || violation.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                        {formatDate(violation.incidentDate)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            fetchViolationDetails(violation._id);
                          }}
                          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                        >
                          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4 dark:border-gray-700">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Showing page {currentPage} of {pagination.pages} ({pagination.total} total)
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="rounded-lg border border-gray-300 px-3 py-1 text-sm disabled:opacity-50 dark:border-gray-600"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(pagination.pages, p + 1))}
                  disabled={currentPage === pagination.pages}
                  className="rounded-lg border border-gray-300 px-3 py-1 text-sm disabled:opacity-50 dark:border-gray-600"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Violation Modal */}
      <Modal isOpen={isCreateOpen} onClose={closeCreateModal}>
        <div className="w-full max-w-xl">
          <div className="mb-6">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Record New Violation</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Manually record a WEBTTODA rule violation
            </p>
          </div>

          <form onSubmit={handleCreateViolation} className="space-y-4">
            {/* Driver Search */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Driver
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={driverSearch}
                  onChange={(e) => setDriverSearch(e.target.value)}
                  placeholder="Search by name or email..."
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                />
                {searchingDrivers && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <svg className="h-4 w-4 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  </div>
                )}
                {driverResults.length > 0 && !createForm.driverId && (
                  <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
                    {driverResults.map((driver) => (
                      <button
                        key={driver._id}
                        type="button"
                        onClick={() => {
                          setCreateForm({ ...createForm, driverId: driver._id });
                          setDriverSearch(`${driver.firstname} ${driver.lastname}`);
                          setDriverResults([]);
                        }}
                        className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        <img
                          src={driver.image || "/images/user/default-avatar.png"}
                          alt=""
                          className="h-8 w-8 rounded-full object-cover"
                        />
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {driver.firstname} {driver.lastname}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{driver.email}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Rule Selection */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Rule Violated
              </label>
              <select
                value={createForm.ruleNumber}
                onChange={(e) => setCreateForm({ ...createForm, ruleNumber: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                required
              >
                <option value="">Select a rule...</option>
                {rules.map((rule) => (
                  <option key={rule.id} value={rule.id}>
                    #{rule.id} - {rule.rule}
                  </option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Description (Optional)
              </label>
              <textarea
                value={createForm.description}
                onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                placeholder="Additional details about the violation..."
                rows={3}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              />
            </div>

            {/* Incident Date */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Incident Date
              </label>
              <input
                type="date"
                value={createForm.incidentDate}
                onChange={(e) => setCreateForm({ ...createForm, incidentDate: e.target.value })}
                max={new Date().toISOString().split("T")[0]}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                required
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={closeCreateModal}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createLoading || !createForm.driverId || !createForm.ruleNumber}
                className="flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
              >
                {createLoading ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Recording...
                  </>
                ) : (
                  "Record Violation"
                )}
              </button>
            </div>
          </form>
        </div>
      </Modal>

      {/* Violation Details Modal */}
      <Modal isOpen={isDetailsOpen} onClose={closeDetailsModal}>
        {selectedViolation && (
          <div className="w-full max-w-2xl">
            <div className="mb-6 flex items-start justify-between">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Violation Details
                </h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Rule #{selectedViolation.violation.ruleNumber} - {selectedViolation.violation.offenseNumber}{getOrdinalSuffix(selectedViolation.violation.offenseNumber)} Offense
                </p>
              </div>
              <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${PENALTY_BADGES[selectedViolation.violation.penalty?.action]?.color}`}>
                {selectedViolation.violation.penalty?.label}
              </span>
            </div>

            <div className="space-y-6">
              {/* Driver Info */}
              <div className="flex items-center gap-4 rounded-lg bg-gray-50 p-4 dark:bg-gray-800/50">
                <img
                  src={selectedViolation.violation.driver?.image || "/images/user/default-avatar.png"}
                  alt=""
                  className="h-16 w-16 rounded-full object-cover"
                />
                <div>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {selectedViolation.violation.driver?.firstname} {selectedViolation.violation.driver?.lastname}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {selectedViolation.violation.driver?.email}
                  </p>
                  <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                    Total violations: {selectedViolation.driverStats?.total || 0} | 
                    Warnings: {selectedViolation.driverStats?.warnings || 0} | 
                    Suspensions: {selectedViolation.driverStats?.suspensions || 0}
                  </p>
                </div>
              </div>

              {/* Rule Details */}
              <div>
                <h4 className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">Rule Violated</h4>
                <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                  <p className="font-medium text-gray-900 dark:text-white">
                    {selectedViolation.violation.ruleDetails?.rule}
                  </p>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Category: {selectedViolation.violation.ruleDetails?.categoryName}
                  </p>
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                    {selectedViolation.violation.ruleDetails?.offense}
                  </p>
                </div>
              </div>

              {/* Description */}
              {selectedViolation.violation.description && (
                <div>
                  <h4 className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">Description</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    {selectedViolation.violation.description}
                  </p>
                </div>
              )}

              {/* Status & Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="mb-1 text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">Status</h4>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGES[selectedViolation.violation.status]?.color}`}>
                    {STATUS_BADGES[selectedViolation.violation.status]?.label}
                  </span>
                </div>
                <div>
                  <h4 className="mb-1 text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">Incident Date</h4>
                  <p className="text-sm text-gray-900 dark:text-white">{formatDate(selectedViolation.violation.incidentDate)}</p>
                </div>
                <div>
                  <h4 className="mb-1 text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">Source</h4>
                  <p className="text-sm text-gray-900 dark:text-white capitalize">{selectedViolation.violation.source?.replace(/_/g, " ")}</p>
                </div>
                <div>
                  <h4 className="mb-1 text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">Created</h4>
                  <p className="text-sm text-gray-900 dark:text-white">{formatDate(selectedViolation.violation.createdAt)}</p>
                </div>
              </div>

              {/* Appeal Section */}
              {selectedViolation.violation.appeal?.isAppealed && (
                <div className="rounded-lg border border-purple-200 bg-purple-50 p-4 dark:border-purple-800 dark:bg-purple-900/20">
                  <h4 className="mb-2 text-sm font-semibold text-purple-900 dark:text-purple-200">Appeal Information</h4>
                  <p className="text-sm text-purple-700 dark:text-purple-300">
                    <strong>Reason:</strong> {selectedViolation.violation.appeal.appealReason}
                  </p>
                  <p className="mt-1 text-sm text-purple-700 dark:text-purple-300">
                    <strong>Filed:</strong> {formatDate(selectedViolation.violation.appeal.appealedAt)}
                  </p>
                  {selectedViolation.violation.appeal.appealDecision !== "pending" && (
                    <p className="mt-1 text-sm text-purple-700 dark:text-purple-300">
                      <strong>Decision:</strong> {selectedViolation.violation.appeal.appealDecision}
                    </p>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3 border-t border-gray-200 pt-4 dark:border-gray-700">
                <button
                  onClick={closeDetailsModal}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  Close
                </button>
                {selectedViolation.violation.appeal?.isAppealed && selectedViolation.violation.appeal?.appealDecision === "pending" && (
                  <button
                    onClick={() => {
                      closeDetailsModal();
                      openAppealModal();
                    }}
                    className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
                  >
                    Process Appeal
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Process Appeal Modal */}
      <Modal isOpen={isAppealOpen} onClose={closeAppealModal}>
        {selectedViolation && (
          <div className="w-full max-w-md">
            <div className="mb-6">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Process Appeal</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Review and decide on the driver's appeal
              </p>
            </div>

            <form onSubmit={handleProcessAppeal} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Decision
                </label>
                <select
                  value={appealForm.decision}
                  onChange={(e) => setAppealForm({ ...appealForm, decision: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  required
                >
                  <option value="">Select decision...</option>
                  <option value="upheld">Upheld (Keep original penalty)</option>
                  <option value="reduced">Reduced (Lower the penalty)</option>
                  <option value="overturned">Overturned (Remove penalty)</option>
                </select>
              </div>

              {appealForm.decision === "reduced" && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Reduced Suspension Days
                  </label>
                  <input
                    type="number"
                    value={appealForm.reducedDays}
                    onChange={(e) => setAppealForm({ ...appealForm, reducedDays: parseInt(e.target.value) || 0 })}
                    min={0}
                    max={selectedViolation.violation.penalty?.days || 30}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                    required
                  />
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Notes
                </label>
                <textarea
                  value={appealForm.notes}
                  onChange={(e) => setAppealForm({ ...appealForm, notes: e.target.value })}
                  placeholder="Reason for this decision..."
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeAppealModal}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={appealLoading || !appealForm.decision}
                  className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
                >
                  {appealLoading ? "Processing..." : "Submit Decision"}
                </button>
              </div>
            </form>
          </div>
        )}
      </Modal>

      {/* WEBTTODA Rules Reference Modal */}
      <Modal isOpen={isRulesOpen} onClose={closeRulesModal}>
        <div className="w-full max-w-3xl max-h-[80vh] overflow-y-auto">
          <div className="mb-6">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">WEBTTODA Rules & Regulations</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Complete list of rules with associated penalties
            </p>
          </div>

          <div className="space-y-6">
            {RULE_CATEGORIES.map((category) => (
              <div key={category.id}>
                <h4 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-600 dark:text-gray-400">
                  {category.id}. {category.name}
                </h4>
                <div className="space-y-2">
                  {rules
                    .filter((r) => r.category === category.id)
                    .map((rule) => (
                      <div
                        key={rule.id}
                        className="rounded-lg border border-gray-200 p-3 dark:border-gray-700"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              #{rule.id}. {rule.rule}
                            </p>
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                              {rule.offense}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {rule.penalties.map((penalty, idx) => (
                              <span
                                key={idx}
                                className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs ${
                                  penalty.action === "warning"
                                    ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                                    : penalty.action === "suspension"
                                    ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                                    : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                }`}
                              >
                                {penalty.label}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={closeRulesModal}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default Violations;
