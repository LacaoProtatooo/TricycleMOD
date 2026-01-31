import { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import PageMeta from "../components/common/PageMeta";
import PageBreadcrumb from "../components/common/PageBreadCrumb";
import SentimentQuadrantChart from "../components/charts/scatter/SentimentQuadrantChart";
import {
  fetchAllComplaints,
  fetchComplaintDetails,
  updateComplaintStatus,
  resolveComplaint,
  addComplaintNote,
} from "../redux/actions/complaintAction";
import {
  clearSelectedComplaint,
  setComplaintFilters,
} from "../redux/reducers/complaintReducer";

const Complaints = () => {
  const dispatch = useDispatch();
  const [showQuadrantChart, setShowQuadrantChart] = useState(false);
  const {
    complaints,
    total,
    page,
    pages,
    loading,
    error,
    stats,
    selectedComplaint,
    detailsLoading,
    updating,
    filters,
  } = useSelector((state) => state.complaint);

  const [currentPage, setCurrentPage] = useState(1);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolveAction, setResolveAction] = useState("");
  const [resolveDetails, setResolveDetails] = useState("");
  const [isFalseComplaint, setIsFalseComplaint] = useState(false);
  const [newNote, setNewNote] = useState("");

  const categoryLabels = {
    rude_behavior: "Rude Behavior",
    overcharging: "Overcharging",
    unsafe_driving: "Unsafe Driving",
    route_deviation: "Route Deviation",
    vehicle_condition: "Vehicle Condition",
    refusal_of_service: "Refusal of Service",
    harassment: "Harassment",
    discrimination: "Discrimination",
    intoxicated_driving: "Intoxicated Driving",
    other: "Other",
  };

  const statusColors = {
    pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
    under_review: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    investigating: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
    resolved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    dismissed: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
    withdrawn: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400",
  };

  const statusLabels = {
    pending: "Pending",
    under_review: "Under Review",
    investigating: "Investigating",
    resolved: "Resolved",
    dismissed: "Dismissed",
    withdrawn: "Withdrawn",
  };

  const urgencyColors = {
    critical: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700",
    high: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-700",
    medium: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-700",
    low: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700",
    normal: "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600",
  };

  const urgencyLabels = {
    critical: "🚨 CRITICAL",
    high: "⚠️ HIGH",
    medium: "📋 MEDIUM",
    low: "📝 LOW",
    normal: "📄 NORMAL",
  };

  const actionLabels = {
    warning_issued: "Warning Issued",
    suspension: "Suspension",
    termination: "Termination",
    mediation: "Mediation",
    no_action: "No Action",
    referred_to_authorities: "Referred to Authorities",
  };

  // Fetch complaints
  useEffect(() => {
    dispatch(fetchAllComplaints({
      page: currentPage,
      limit: 20,
      ...filters,
    }));
  }, [dispatch, currentPage, filters]);

  const handleFilterChange = (key, value) => {
    dispatch(setComplaintFilters({ [key]: value }));
    setCurrentPage(1);
  };

  const handleViewDetails = (complaintId) => {
    dispatch(fetchComplaintDetails(complaintId));
    setShowDetailModal(true);
  };

  const handleCloseModal = () => {
    setShowDetailModal(false);
    dispatch(clearSelectedComplaint());
  };

  const handleStatusChange = async (newStatus) => {
    if (selectedComplaint) {
      await dispatch(updateComplaintStatus({
        complaintId: selectedComplaint._id,
        status: newStatus,
        note: `Status changed to ${statusLabels[newStatus]}`,
      }));
      dispatch(fetchAllComplaints({ page: currentPage, limit: 20, ...filters }));
    }
  };

  const handleOpenResolve = () => {
    setShowResolveModal(true);
    setResolveAction("");
    setResolveDetails("");
    setIsFalseComplaint(false);
  };

  const handleResolve = async () => {
    if (selectedComplaint && resolveAction) {
      await dispatch(resolveComplaint({
        complaintId: selectedComplaint._id,
        action: resolveAction,
        details: resolveDetails,
        isFalseComplaint,
      }));
      setShowResolveModal(false);
      dispatch(fetchAllComplaints({ page: currentPage, limit: 20, ...filters }));
    }
  };

  const handleAddNote = async () => {
    if (selectedComplaint && newNote.trim()) {
      await dispatch(addComplaintNote({
        complaintId: selectedComplaint._id,
        note: newNote,
      }));
      setNewNote("");
      dispatch(fetchComplaintDetails(selectedComplaint._id));
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getCredibilityColor = (score) => {
    if (score >= 70) return "text-green-600 dark:text-green-400";
    if (score >= 40) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const getCredibilityBg = (score) => {
    if (score >= 70) return "bg-green-100 dark:bg-green-900/30";
    if (score >= 40) return "bg-yellow-100 dark:bg-yellow-900/30";
    return "bg-red-100 dark:bg-red-900/30";
  };

  return (
    <>
      <PageMeta
        title="Complaints Management | TricycleMOD Admin"
        description="Review and manage driver complaints"
      />
      <PageBreadcrumb pageTitle="Complaints Management" />

      {/* Statistics Cards */}
      {stats && (
        <div className="space-y-4 mb-6">
          {/* Priority Alert - High Priority Complaints */}
          {stats.priority?.needsImmediateAttention > 0 && (
            <div className="rounded-xl border-2 border-red-300 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0">
                    <span className="text-3xl">🚨</span>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-red-800 dark:text-red-200">
                      {stats.priority.needsImmediateAttention} Complaint{stats.priority.needsImmediateAttention > 1 ? 's' : ''} Need Immediate Attention
                    </p>
                    <p className="text-sm text-red-600 dark:text-red-300">
                      High-priority complaints detected by sentiment analysis
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    handleFilterChange("priorityOnly", "true");
                  }}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium text-sm"
                >
                  View Priority Complaints
                </button>
              </div>
            </div>
          )}

          {/* Sentiment Priority Cards */}
          {stats.priority && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <button
                onClick={() => handleFilterChange("urgency", "critical")}
                className={`rounded-xl border-2 p-3 text-left transition-all hover:shadow-md ${
                  filters.urgency === "critical" ? "border-red-500 ring-2 ring-red-200" : "border-red-200"
                } bg-red-50 dark:bg-red-900/20`}
              >
                <p className="text-xs text-red-600 font-medium">🚨 CRITICAL</p>
                <p className="text-2xl font-bold text-red-700">{stats.priority.critical}</p>
                <p className="text-xs text-red-500">Urgent review</p>
              </button>
              <button
                onClick={() => handleFilterChange("urgency", "high")}
                className={`rounded-xl border-2 p-3 text-left transition-all hover:shadow-md ${
                  filters.urgency === "high" ? "border-orange-500 ring-2 ring-orange-200" : "border-orange-200"
                } bg-orange-50 dark:bg-orange-900/20`}
              >
                <p className="text-xs text-orange-600 font-medium">⚠️ HIGH</p>
                <p className="text-2xl font-bold text-orange-700">{stats.priority.high}</p>
                <p className="text-xs text-orange-500">Within 24hrs</p>
              </button>
              <button
                onClick={() => handleFilterChange("urgency", "medium")}
                className={`rounded-xl border-2 p-3 text-left transition-all hover:shadow-md ${
                  filters.urgency === "medium" ? "border-yellow-500 ring-2 ring-yellow-200" : "border-yellow-200"
                } bg-yellow-50 dark:bg-yellow-900/20`}
              >
                <p className="text-xs text-yellow-600 font-medium">📋 MEDIUM</p>
                <p className="text-2xl font-bold text-yellow-700">{stats.priority.medium}</p>
                <p className="text-xs text-yellow-500">Standard</p>
              </button>
              <button
                onClick={() => handleFilterChange("urgency", "low")}
                className={`rounded-xl border-2 p-3 text-left transition-all hover:shadow-md ${
                  filters.urgency === "low" ? "border-green-500 ring-2 ring-green-200" : "border-green-200"
                } bg-green-50 dark:bg-green-900/20`}
              >
                <p className="text-xs text-green-600 font-medium">📝 LOW</p>
                <p className="text-2xl font-bold text-green-700">{stats.priority.low}</p>
                <p className="text-xs text-green-500">As available</p>
              </button>
              <button
                onClick={() => handleFilterChange("urgency", "")}
                className={`rounded-xl border-2 p-3 text-left transition-all hover:shadow-md ${
                  !filters.urgency ? "border-gray-500 ring-2 ring-gray-200" : "border-gray-200"
                } bg-gray-50 dark:bg-gray-800`}
              >
                <p className="text-xs text-gray-600 font-medium">📊 ALL</p>
                <p className="text-2xl font-bold text-gray-700 dark:text-gray-200">{stats.total}</p>
                <p className="text-xs text-gray-500">Total complaints</p>
              </button>
            </div>
          )}

          {/* Status Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
              <p className="text-sm text-gray-500">Total</p>
              <p className="text-2xl font-bold text-gray-800 dark:text-white">{stats.total}</p>
            </div>
            <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-900/20">
              <p className="text-sm text-yellow-600">Pending</p>
              <p className="text-2xl font-bold text-yellow-700">{stats.pending}</p>
            </div>
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
              <p className="text-sm text-blue-600">Under Review</p>
              <p className="text-2xl font-bold text-blue-700">{stats.underReview}</p>
            </div>
            <div className="rounded-xl border border-purple-200 bg-purple-50 p-4 dark:border-purple-800 dark:bg-purple-900/20">
              <p className="text-sm text-purple-600">Investigating</p>
              <p className="text-2xl font-bold text-purple-700">{stats.investigating}</p>
            </div>
            <div className="rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
              <p className="text-sm text-green-600">Resolved</p>
              <p className="text-2xl font-bold text-green-700">{stats.resolved}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900/20">
              <p className="text-sm text-gray-600">Dismissed</p>
              <p className="text-2xl font-bold text-gray-700">{stats.dismissed}</p>
            </div>
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
              <p className="text-sm text-red-600">Low Credibility</p>
              <p className="text-2xl font-bold text-red-700">{stats.lowCredibility}</p>
            </div>
          </div>

          {/* Toggle Sentiment Quadrant Chart */}
          <div className="flex justify-end">
            <button
              onClick={() => setShowQuadrantChart(!showQuadrantChart)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                showQuadrantChart 
                  ? 'bg-blue-600 text-white hover:bg-blue-700' 
                  : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              {showQuadrantChart ? 'Hide Sentiment Quadrant' : 'Show Sentiment Quadrant'}
            </button>
          </div>

          {/* Sentiment Quadrant Scatter Plot */}
          {showQuadrantChart && (
            <div className="animate-in fade-in duration-300">
              <SentimentQuadrantChart />
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 mb-6 dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
            <select
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-orange-500 dark:border-gray-600 dark:bg-gray-800"
              value={filters.status}
              onChange={(e) => handleFilterChange("status", e.target.value)}
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="under_review">Under Review</option>
              <option value="investigating">Investigating</option>
              <option value="resolved">Resolved</option>
              <option value="dismissed">Dismissed</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
            <select
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-orange-500 dark:border-gray-600 dark:bg-gray-800"
              value={filters.category}
              onChange={(e) => handleFilterChange("category", e.target.value)}
            >
              <option value="">All Categories</option>
              {Object.entries(categoryLabels).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Priority (AI)</label>
            <select
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-orange-500 dark:border-gray-600 dark:bg-gray-800"
              value={filters.urgency || ""}
              onChange={(e) => handleFilterChange("urgency", e.target.value)}
            >
              <option value="">All Priorities</option>
              <option value="critical">🚨 Critical</option>
              <option value="high">⚠️ High</option>
              <option value="medium">📋 Medium</option>
              <option value="low">📝 Low</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Credibility</label>
            <select
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-orange-500 dark:border-gray-600 dark:bg-gray-800"
              value={filters.minCredibility ? `${filters.minCredibility}-${filters.maxCredibility}` : ""}
              onChange={(e) => {
                const [min, max] = e.target.value ? e.target.value.split("-") : ["", ""];
                dispatch(setComplaintFilters({ minCredibility: min, maxCredibility: max }));
                setCurrentPage(1);
              }}
            >
              <option value="">All Scores</option>
              <option value="70-100">High (70-100)</option>
              <option value="40-69">Medium (40-69)</option>
              <option value="0-39">Low (0-39)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Sort By</label>
            <select
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-orange-500 dark:border-gray-600 dark:bg-gray-800"
              value={`${filters.sortBy}-${filters.sortOrder}`}
              onChange={(e) => {
                const [sortBy, sortOrder] = e.target.value.split("-");
                dispatch(setComplaintFilters({ sortBy, sortOrder }));
                setCurrentPage(1);
              }}
            >
              <option value="createdAt-desc">Newest First</option>
              <option value="createdAt-asc">Oldest First</option>
              <option value="priority-desc">Highest Priority</option>
              <option value="credibilityScore-desc">Highest Credibility</option>
              <option value="credibilityScore-asc">Lowest Credibility</option>
            </select>
          </div>
        </div>
        {/* Active filters indicator */}
        {(filters.urgency || filters.priorityOnly) && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-sm text-gray-500">Active filters:</span>
            {filters.urgency && (
              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${urgencyColors[filters.urgency]}`}>
                {urgencyLabels[filters.urgency]}
                <button 
                  onClick={() => handleFilterChange("urgency", "")}
                  className="ml-1 hover:opacity-70"
                >×</button>
              </span>
            )}
            {filters.priorityOnly === "true" && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
                🚨 Priority Only
                <button 
                  onClick={() => handleFilterChange("priorityOnly", "")}
                  className="ml-1 hover:opacity-70"
                >×</button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Complaints Table */}
      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="p-4 border-b border-gray-200 dark:border-gray-800">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
            Complaints ({total})
          </h3>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-500">{error}</div>
        ) : complaints.length === 0 ? (
          <div className="p-12 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="mt-2 text-gray-500">No complaints found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Complainant</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Driver</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Credibility</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Evidence</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {complaints.map((complaint) => (
                  <tr key={complaint._id} className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 ${
                    complaint.sentimentAnalysis?.flags?.mayRequireImmediateAttention ? 'bg-red-50/50 dark:bg-red-900/10' : ''
                  }`}>
                    <td className="px-4 py-4">
                      {complaint.sentimentAnalysis?.urgency ? (
                        <div className="flex flex-col items-start gap-1">
                          <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${
                            urgencyColors[complaint.sentimentAnalysis.urgency] || urgencyColors.normal
                          }`}>
                            {urgencyLabels[complaint.sentimentAnalysis.urgency] || '📄 N/A'}
                          </span>
                          {complaint.sentimentAnalysis.flags?.mayRequireImmediateAttention && (
                            <span className="text-xs text-red-600 font-medium">⚡ Immediate</span>
                          )}
                          <span className="text-xs text-gray-400">
                            {complaint.sentimentAnalysis.confidence ? `${Math.round(complaint.sentimentAnalysis.confidence * 100)}% conf.` : ''}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">Not analyzed</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center">
                        <div className="h-10 w-10 flex-shrink-0 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                          {complaint.complainant?.image?.url ? (
                            <img src={complaint.complainant.image.url} alt="" className="h-10 w-10 rounded-full object-cover" />
                          ) : (
                            <span className="text-orange-600 dark:text-orange-400 font-medium">
                              {complaint.complainant?.firstname?.[0]}{complaint.complainant?.lastname?.[0]}
                            </span>
                          )}
                        </div>
                        <div className="ml-3">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {complaint.complainant?.firstname} {complaint.complainant?.lastname}
                          </p>
                          <p className="text-xs text-gray-500">@{complaint.complainant?.username}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center">
                        <div className="h-10 w-10 flex-shrink-0 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                          {complaint.driver?.image?.url ? (
                            <img src={complaint.driver.image.url} alt="" className="h-10 w-10 rounded-full object-cover" />
                          ) : (
                            <span className="text-gray-600 dark:text-gray-300 font-medium">
                              {complaint.driver?.firstname?.[0]}{complaint.driver?.lastname?.[0]}
                            </span>
                          )}
                        </div>
                        <div className="ml-3">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {complaint.driver?.firstname} {complaint.driver?.lastname}
                          </p>
                          <p className="text-xs text-gray-500">@{complaint.driver?.username}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {categoryLabels[complaint.category] || complaint.category}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${statusColors[complaint.status]}`}>
                        {statusLabels[complaint.status]}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${getCredibilityBg(complaint.credibilityScore)} ${getCredibilityColor(complaint.credibilityScore)}`}>
                        {complaint.credibilityScore}%
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm text-gray-600">
                        {complaint.evidence?.length || 0} files
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm text-gray-500">{formatDate(complaint.createdAt)}</span>
                    </td>
                    <td className="px-4 py-4">
                      <button
                        onClick={() => handleViewDetails(complaint._id)}
                        className="text-orange-600 hover:text-orange-800 font-medium text-sm"
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500">
              Page {page} of {pages} ({total} total)
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1 rounded border border-gray-300 text-sm disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.min(pages, p + 1))}
                disabled={page >= pages}
                className="px-3 py-1 rounded border border-gray-300 text-sm disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Complaint Detail Modal */}
      {showDetailModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="fixed inset-0 bg-black bg-opacity-50" onClick={handleCloseModal}></div>
            <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              {detailsLoading ? (
                <div className="flex justify-center items-center py-20">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                </div>
              ) : selectedComplaint ? (
                <>
                  {/* Modal Header */}
                  <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-between items-center">
                    <div>
                      <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                        Complaint Review
                      </h2>
                      <p className="text-sm text-gray-500 mt-1">
                        Filed on {formatDate(selectedComplaint.createdAt)}
                      </p>
                    </div>
                    <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600">
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {/* Modal Content */}
                  <div className="p-6">
                    {/* Status & Credibility */}
                    <div className="flex flex-wrap gap-4 mb-6">
                      <div className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${statusColors[selectedComplaint.status]}`}>
                        {statusLabels[selectedComplaint.status]}
                      </div>
                      <div className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${getCredibilityBg(selectedComplaint.credibilityScore)} ${getCredibilityColor(selectedComplaint.credibilityScore)}`}>
                        Credibility Score: {selectedComplaint.credibilityScore}%
                      </div>
                      {selectedComplaint.isFalseComplaint && (
                        <div className="inline-flex items-center rounded-full px-3 py-1 text-sm font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                          ⚠️ Marked as False Complaint
                        </div>
                      )}
                    </div>

                    {/* AI Sentiment Analysis Card */}
                    {selectedComplaint.sentimentAnalysis && (
                      <div className={`rounded-lg p-4 mb-6 border-2 ${
                        selectedComplaint.sentimentAnalysis.urgency === 'critical' ? 'bg-red-50 border-red-300 dark:bg-red-900/20 dark:border-red-700' :
                        selectedComplaint.sentimentAnalysis.urgency === 'high' ? 'bg-orange-50 border-orange-300 dark:bg-orange-900/20 dark:border-orange-700' :
                        selectedComplaint.sentimentAnalysis.urgency === 'medium' ? 'bg-yellow-50 border-yellow-300 dark:bg-yellow-900/20 dark:border-yellow-700' :
                        'bg-gray-50 border-gray-200 dark:bg-gray-800 dark:border-gray-700'
                      }`}>
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                            🧠 AI Sentiment Analysis
                            {selectedComplaint.sentimentAnalysis.flags?.mayRequireImmediateAttention && (
                              <span className="text-xs bg-red-600 text-white px-2 py-0.5 rounded-full animate-pulse">
                                ⚡ IMMEDIATE ATTENTION
                              </span>
                            )}
                          </h4>
                          <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-bold ${
                            urgencyColors[selectedComplaint.sentimentAnalysis.urgency] || urgencyColors.normal
                          }`}>
                            {urgencyLabels[selectedComplaint.sentimentAnalysis.urgency] || 'N/A'}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Sentiment</p>
                            <p className={`font-semibold ${
                              selectedComplaint.sentimentAnalysis.sentiment === 'negative' ? 'text-red-600 dark:text-red-400' :
                              selectedComplaint.sentimentAnalysis.sentiment === 'positive' ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-300'
                            }`}>
                              {selectedComplaint.sentimentAnalysis.sentiment?.charAt(0).toUpperCase() + 
                               selectedComplaint.sentimentAnalysis.sentiment?.slice(1)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Confidence</p>
                            <p className="font-semibold text-gray-800 dark:text-gray-200">
                              {Math.round((selectedComplaint.sentimentAnalysis.confidence || 0) * 100)}%
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Severity Score</p>
                            <p className="font-semibold text-gray-800 dark:text-gray-200">
                              {selectedComplaint.sentimentAnalysis.severityScore?.toFixed(1) || 'N/A'}/5
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase">Description Quality</p>
                            <p className={`font-semibold ${
                              selectedComplaint.sentimentAnalysis.descriptionQuality >= 70 ? 'text-green-600 dark:text-green-400' :
                              selectedComplaint.sentimentAnalysis.descriptionQuality >= 40 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'
                            }`}>
                              {selectedComplaint.sentimentAnalysis.descriptionQuality || 'N/A'}%
                            </p>
                          </div>
                        </div>
                        {selectedComplaint.sentimentAnalysis.flags?.emotionallyCharged && (
                          <p className="mt-3 text-sm text-orange-700 bg-orange-100 dark:text-orange-300 dark:bg-orange-900/30 px-3 py-1 rounded">
                            ⚡ Emotionally charged language detected - handle with care
                          </p>
                        )}
                      </div>
                    )}

                    {/* Flags Warning */}
                    {selectedComplaint.flags && Object.values(selectedComplaint.flags).some(Boolean) && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6 dark:bg-yellow-900/20 dark:border-yellow-700">
                        <h4 className="font-medium text-yellow-800 dark:text-yellow-300 mb-2">⚠️ Flags Detected</h4>
                        <ul className="text-sm text-yellow-700 dark:text-yellow-400 space-y-1">
                          {selectedComplaint.flags.isFromNewAccount && <li>• Account is less than 7 days old</li>}
                          {selectedComplaint.flags.hasMultipleComplaintsToday && <li>• Multiple complaints filed today</li>}
                          {selectedComplaint.flags.targetsSameDriver && <li>• Has complained about this driver before</li>}
                          {selectedComplaint.flags.hasVagueDescription && <li>• Description is relatively short</li>}
                        </ul>
                      </div>
                    )}

                    {/* Parties Involved */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                      {/* Complainant */}
                      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                        <h4 className="font-medium text-gray-900 dark:text-white mb-3">Complainant</h4>
                        <div className="flex items-center">
                          <div className="h-12 w-12 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                            {selectedComplaint.complainant?.image?.url ? (
                              <img src={selectedComplaint.complainant.image.url} alt="" className="h-12 w-12 rounded-full object-cover" />
                            ) : (
                              <span className="text-orange-600 dark:text-orange-400 font-bold">
                                {selectedComplaint.complainant?.firstname?.[0]}{selectedComplaint.complainant?.lastname?.[0]}
                              </span>
                            )}
                          </div>
                          <div className="ml-4">
                            <p className="font-medium text-gray-900 dark:text-white">
                              {selectedComplaint.complainant?.firstname} {selectedComplaint.complainant?.lastname}
                            </p>
                            <p className="text-sm text-gray-500">@{selectedComplaint.complainant?.username}</p>
                            <p className="text-sm text-gray-500">{selectedComplaint.complainant?.email}</p>
                          </div>
                        </div>
                      </div>

                      {/* Driver */}
                      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                        <h4 className="font-medium text-gray-900 dark:text-white mb-3">Driver (Accused)</h4>
                        <div className="flex items-center">
                          <div className="h-12 w-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                            {selectedComplaint.driver?.image?.url ? (
                              <img src={selectedComplaint.driver.image.url} alt="" className="h-12 w-12 rounded-full object-cover" />
                            ) : (
                              <span className="text-gray-600 dark:text-gray-300 font-bold">
                                {selectedComplaint.driver?.firstname?.[0]}{selectedComplaint.driver?.lastname?.[0]}
                              </span>
                            )}
                          </div>
                          <div className="ml-4">
                            <p className="font-medium text-gray-900 dark:text-white">
                              {selectedComplaint.driver?.firstname} {selectedComplaint.driver?.lastname}
                            </p>
                            <p className="text-sm text-gray-500">@{selectedComplaint.driver?.username}</p>
                            <p className="text-sm text-gray-500">{selectedComplaint.driver?.phone}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Complaint Details */}
                    <div className="mb-6">
                      <h4 className="font-medium text-gray-900 dark:text-white mb-3">Complaint Details</h4>
                      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-3">
                        <div>
                          <span className="text-sm text-gray-500">Category:</span>
                          <span className="ml-2 font-medium text-gray-900 dark:text-white">
                            {categoryLabels[selectedComplaint.category] || selectedComplaint.category}
                          </span>
                        </div>
                        <div>
                          <span className="text-sm text-gray-500">Incident Date:</span>
                          <span className="ml-2 font-medium text-gray-900 dark:text-white">
                            {formatDate(selectedComplaint.incidentDate)}
                          </span>
                        </div>
                        <div>
                          <span className="text-sm text-gray-500 block mb-1">Description:</span>
                          <p className="text-gray-900 dark:text-white whitespace-pre-wrap">
                            {selectedComplaint.description}
                          </p>
                        </div>
                        {selectedComplaint.tricycleDetails?.plateNumber && (
                          <div>
                            <span className="text-sm text-gray-500">Plate Number:</span>
                            <span className="ml-2 font-medium text-gray-900 dark:text-white">
                              {selectedComplaint.tricycleDetails.plateNumber}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Evidence */}
                    <div className="mb-6">
                      <h4 className="font-medium text-gray-900 dark:text-white mb-3">
                        Evidence ({selectedComplaint.evidence?.length || 0})
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {selectedComplaint.evidence?.map((item, index) => (
                          <a
                            key={index}
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block aspect-square rounded-lg overflow-hidden border border-gray-200 hover:border-orange-500 transition-colors"
                          >
                            <img
                              src={item.url}
                              alt={`Evidence ${index + 1}`}
                              className="w-full h-full object-cover"
                            />
                          </a>
                        ))}
                      </div>
                    </div>

                    {/* Resolution (if resolved) */}
                    {selectedComplaint.resolution?.action && (
                      <div className="mb-6">
                        <h4 className="font-medium text-gray-900 dark:text-white mb-3">Resolution</h4>
                        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                          <p className="font-medium text-green-800 dark:text-green-300">
                            Action: {actionLabels[selectedComplaint.resolution.action] || selectedComplaint.resolution.action}
                          </p>
                          {selectedComplaint.resolution.details && (
                            <p className="text-sm text-green-700 dark:text-green-400 mt-2">
                              {selectedComplaint.resolution.details}
                            </p>
                          )}
                          <p className="text-xs text-green-600 mt-2">
                            Resolved on {formatDate(selectedComplaint.resolution.resolvedAt)}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Admin Notes */}
                    <div className="mb-6">
                      <h4 className="font-medium text-gray-900 dark:text-white mb-3">Admin Notes</h4>
                      {selectedComplaint.adminNotes?.length > 0 ? (
                        <div className="space-y-3 max-h-48 overflow-y-auto">
                          {selectedComplaint.adminNotes.map((note, index) => (
                            <div key={index} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                              <p className="text-sm text-gray-900 dark:text-white">{note.note}</p>
                              <p className="text-xs text-gray-500 mt-1">{formatDate(note.addedAt)}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">No notes yet</p>
                      )}
                      
                      {/* Add Note */}
                      {!['resolved', 'dismissed', 'withdrawn'].includes(selectedComplaint.status) && (
                        <div className="mt-3 flex gap-2">
                          <input
                            type="text"
                            placeholder="Add a note..."
                            value={newNote}
                            onChange={(e) => setNewNote(e.target.value)}
                            className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:border-orange-500 focus:ring-orange-500"
                          />
                          <button
                            onClick={handleAddNote}
                            disabled={!newNote.trim() || updating}
                            className="px-4 py-2 bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50"
                          >
                            Add
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    {!['resolved', 'dismissed', 'withdrawn'].includes(selectedComplaint.status) && (
                      <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                        <h4 className="font-medium text-gray-900 dark:text-white mb-3">Take Action</h4>
                        <div className="flex flex-wrap gap-3">
                          {selectedComplaint.status === 'pending' && (
                            <button
                              onClick={() => handleStatusChange('under_review')}
                              disabled={updating}
                              className="px-4 py-2 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded-lg text-sm font-medium hover:bg-blue-200 dark:hover:bg-blue-900/50 disabled:opacity-50"
                            >
                              Start Review
                            </button>
                          )}
                          {selectedComplaint.status === 'under_review' && (
                            <button
                              onClick={() => handleStatusChange('investigating')}
                              disabled={updating}
                              className="px-4 py-2 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 rounded-lg text-sm font-medium hover:bg-purple-200 dark:hover:bg-purple-900/50 disabled:opacity-50"
                            >
                              Start Investigation
                            </button>
                          )}
                          <button
                            onClick={handleOpenResolve}
                            disabled={updating}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                          >
                            Resolve Complaint
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Resolve Modal */}
      {showResolveModal && (
        <div className="fixed inset-0 z-[60] overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setShowResolveModal(false)}></div>
            <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Resolve Complaint</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Action to Take *
                  </label>
                  <select
                    value={resolveAction}
                    onChange={(e) => setResolveAction(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-orange-500 focus:ring-orange-500"
                  >
                    <option value="">Select action...</option>
                    <option value="warning_issued">Issue Warning to Driver</option>
                    <option value="suspension">Suspend Driver</option>
                    <option value="termination">Terminate Driver</option>
                    <option value="mediation">Mediation Required</option>
                    <option value="referred_to_authorities">Refer to Authorities</option>
                    <option value="no_action">No Action Needed</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Resolution Details
                  </label>
                  <textarea
                    value={resolveDetails}
                    onChange={(e) => setResolveDetails(e.target.value)}
                    placeholder="Provide details about the resolution..."
                    rows={4}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-orange-500 focus:ring-orange-500"
                  />
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="falseComplaint"
                    checked={isFalseComplaint}
                    onChange={(e) => setIsFalseComplaint(e.target.checked)}
                    className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300 rounded"
                  />
                  <label htmlFor="falseComplaint" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    Mark as false/defamatory complaint (will penalize complainant)
                  </label>
                </div>

                {isFalseComplaint && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                    ⚠️ This will apply penalties to the complainant based on their false complaint history.
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowResolveModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 dark:text-gray-300 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  onClick={handleResolve}
                  disabled={!resolveAction || updating}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
                >
                  {updating ? "Processing..." : isFalseComplaint ? "Dismiss Complaint" : "Resolve Complaint"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Complaints;
