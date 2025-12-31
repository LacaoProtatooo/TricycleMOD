import { useState, useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import flatpickr from "flatpickr";
import "flatpickr/dist/flatpickr.css";
import { Modal } from "../components/ui/modal";
import { useModal } from "../hooks/useModal";
import PageMeta from "../components/common/PageMeta";
import PageBreadcrumb from "../components/common/PageBreadCrumb";
import {
  fetchAllBookings,
  fetchBookingDetails,
  fetchBookingStats,
} from "../redux/actions/bookingAction";
import {
  clearSelectedBooking,
  resetBookingFilters,
} from "../redux/reducers/bookingReducer";

const Bookings = () => {
  const dispatch = useDispatch();
  const {
    bookings,
    total,
    page,
    pages,
    loading,
    error,
    selectedBooking,
    detailsLoading,
    stats,
    statsLoading,
    filters,
  } = useSelector((state) => state.booking);

  // Local filter state
  const [searchQuery, setSearchQuery] = useState(filters.search);
  const [statusFilter, setStatusFilter] = useState(filters.status);
  const [startDate, setStartDate] = useState(filters.startDate);
  const [endDate, setEndDate] = useState(filters.endDate);
  const [currentPage, setCurrentPage] = useState(1);

  // Tab state
  const [activeTab, setActiveTab] = useState("all"); // "all" or "disputes"

  // Date picker refs
  const startDateRef = useRef(null);
  const endDateRef = useRef(null);
  const startPickerRef = useRef(null);
  const endPickerRef = useRef(null);

  // Modals
  const { isOpen: isDetailsOpen, openModal: openDetailsModal, closeModal: closeDetailsModal } = useModal();

  // Booking statuses
  const bookingStatuses = {
    pending: { label: "Pending", color: "text-yellow-700 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/20" },
    offer_made: { label: "Offer Made", color: "text-blue-700 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/20" },
    accepted: { label: "Accepted", color: "text-cyan-700 bg-cyan-100 dark:text-cyan-400 dark:bg-cyan-900/20" },
    in_progress: { label: "In Progress", color: "text-purple-700 bg-purple-100 dark:text-purple-400 dark:bg-purple-900/20" },
    awaiting_confirmation: { label: "Awaiting Confirm", color: "text-orange-700 bg-orange-100 dark:text-orange-400 dark:bg-orange-900/20" },
    completed: { label: "Completed", color: "text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-900/20" },
    cancelled: { label: "Cancelled", color: "text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-900/20" },
    expired: { label: "Expired", color: "text-gray-700 bg-gray-100 dark:text-gray-400 dark:bg-gray-800" },
  };

  // Initialize date pickers
  useEffect(() => {
    if (startDateRef.current) {
      startPickerRef.current = flatpickr(startDateRef.current, {
        dateFormat: "Y-m-d",
        defaultDate: startDate || null,
        onChange: (selectedDates, dateStr) => {
          setStartDate(dateStr);
          setCurrentPage(1);
        },
      });
    }

    if (endDateRef.current) {
      endPickerRef.current = flatpickr(endDateRef.current, {
        dateFormat: "Y-m-d",
        defaultDate: endDate || null,
        onChange: (selectedDates, dateStr) => {
          setEndDate(dateStr);
          setCurrentPage(1);
        },
      });
    }

    return () => {
      if (startPickerRef.current) startPickerRef.current.destroy();
      if (endPickerRef.current) endPickerRef.current.destroy();
    };
  }, []);

  // Fetch bookings on mount and filter change
  useEffect(() => {
    dispatch(fetchAllBookings({
      page: currentPage,
      limit: 20,
      status: statusFilter,
      search: searchQuery,
      startDate,
      endDate,
      disputed: activeTab === "disputes",
    }));
  }, [dispatch, currentPage, statusFilter, searchQuery, startDate, endDate, activeTab]);

  // Reset page when tab changes
  useEffect(() => {
    setCurrentPage(1);
    setStatusFilter("");
  }, [activeTab]);

  // Fetch stats on mount
  useEffect(() => {
    dispatch(fetchBookingStats());
  }, [dispatch]);

  const handleViewBooking = (bookingId) => {
    dispatch(fetchBookingDetails(bookingId));
    openDetailsModal();
  };

  const handleCloseDetails = () => {
    closeDetailsModal();
    dispatch(clearSelectedBooking());
  };

  const handleSearch = (e) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  };

  const handleStatusFilter = (status) => {
    setStatusFilter(status === statusFilter ? "" : status);
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("");
    setStartDate("");
    setEndDate("");
    setCurrentPage(1);
    dispatch(resetBookingFilters());
    // Clear flatpickr inputs
    if (startPickerRef.current) startPickerRef.current.clear();
    if (endPickerRef.current) endPickerRef.current.clear();
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return "N/A";
    return `₱${parseFloat(amount).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;
  };

  const formatDistance = (meters) => {
    if (!meters && meters !== 0) return "N/A";
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(2)} km`;
    }
    return `${Math.round(meters)} m`;
  };

  return (
    <>
      <PageMeta
        title="Bookings Management | TricycleMOD Admin"
        description="Manage and monitor all trip bookings"
      />
      <PageBreadcrumb pageTitle="Bookings Management" />

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-9 gap-4 mb-6">
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex flex-col">
            <p className="text-2xl font-semibold text-gray-800 dark:text-white">{statsLoading ? "..." : stats?.total || 0}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Total Bookings</p>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex flex-col">
            <p className="text-2xl font-semibold text-green-600 dark:text-green-400">{statsLoading ? "..." : stats?.completed || 0}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Completed</p>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex flex-col">
            <p className="text-2xl font-semibold text-purple-600 dark:text-purple-400">{statsLoading ? "..." : stats?.in_progress || 0}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">In Progress</p>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex flex-col">
            <p className="text-2xl font-semibold text-yellow-600 dark:text-yellow-400">{statsLoading ? "..." : stats?.pending || 0}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Pending</p>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex flex-col">
            <p className="text-2xl font-semibold text-red-600 dark:text-red-400">{statsLoading ? "..." : stats?.cancelled || 0}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Cancelled</p>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex flex-col">
            <p className="text-2xl font-semibold text-orange-600 dark:text-orange-400">{statsLoading ? "..." : stats?.disputed || 0}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Disputed</p>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex flex-col">
            <p className="text-2xl font-semibold text-cyan-600 dark:text-cyan-400">{statsLoading ? "..." : stats?.todayTotal || 0}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Today's Trips</p>
          </div>
        </div>

        <div className="col-span-2 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex flex-col">
            <p className="text-2xl font-semibold text-brand-600 dark:text-brand-400">{statsLoading ? "..." : formatCurrency(stats?.totalRevenue)}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Total Revenue (Avg: {formatCurrency(stats?.avgFare)})</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-4 border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab("all")}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === "all"
                ? "border-brand-500 text-brand-600 dark:text-brand-400"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
            }`}
          >
            All Bookings
          </button>
          <button
            onClick={() => setActiveTab("disputes")}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-2 ${
              activeTab === "disputes"
                ? "border-orange-500 text-orange-600 dark:text-orange-400"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
            }`}
          >
            Dispute Reports
            {stats?.disputed > 0 && (
              <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold rounded-full bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400">
                {stats.disputed}
              </span>
            )}
          </button>
        </nav>
      </div>

      {/* Main Content */}
      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        {/* Header with Search and Filters */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-800">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                  {activeTab === "all" ? "All Bookings" : "Disputed Bookings"}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {total} {activeTab === "disputes" ? "disputed bookings" : "bookings"} found
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                {/* Search */}
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search user/driver..."
                    value={searchQuery}
                    onChange={handleSearch}
                    className="h-10 w-full sm:w-64 rounded-lg border border-gray-300 bg-transparent pl-10 pr-4 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30"
                  />
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>

                {/* Date Pickers */}
                <div className="flex gap-2">
                  <div className="relative">
                    <input
                      ref={startDateRef}
                      type="text"
                      placeholder="Start date"
                      readOnly
                      className="h-10 w-32 rounded-lg border border-gray-300 bg-transparent pl-3 pr-8 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 cursor-pointer"
                    />
                    <svg className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="relative">
                    <input
                      ref={endDateRef}
                      type="text"
                      placeholder="End date"
                      readOnly
                      className="h-10 w-32 rounded-lg border border-gray-300 bg-transparent pl-3 pr-8 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 cursor-pointer"
                    />
                    <svg className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                </div>
                {/* Clear Filters */}
                {(searchQuery || statusFilter || startDate || endDate) && (
                  <button
                    onClick={clearFilters}
                    className="h-10 px-4 rounded-lg text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 dark:text-gray-400 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Status Filter Pills - Only show for All Bookings tab */}
            {activeTab === "all" && (
              <div className="flex flex-wrap gap-2">
                {Object.entries(bookingStatuses).map(([key, { label, color }]) => (
                  <button
                    key={key}
                    onClick={() => handleStatusFilter(key)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-full transition-all ${
                      statusFilter === key
                        ? `${color} ring-2 ring-offset-2 ring-brand-500`
                        : "text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="p-4 m-4 bg-red-100 border border-red-400 text-red-700 rounded-lg dark:bg-red-900/20 dark:border-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-500"></div>
          </div>
        ) : bookings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500 dark:text-gray-400">
            <svg className="h-16 w-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-lg font-medium">
              {activeTab === "disputes" ? "No disputed bookings" : "No bookings found"}
            </p>
            <p className="text-sm">
              {activeTab === "disputes" ? "All bookings are dispute-free" : "Try adjusting your search or filters"}
            </p>
          </div>
        ) : (
          <>
            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                      Booking ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                      Passenger
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                      Driver
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                      Fare
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                      Status
                    </th>
                    {activeTab === "disputes" && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                        Dispute Reason
                      </th>
                    )}
                    {activeTab === "all" && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                        Rating
                      </th>
                    )}
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                      Date
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                  {bookings.map((booking) => (
                    <tr key={booking._id} className={`hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors ${booking.completionDisputed ? 'bg-orange-50/50 dark:bg-orange-900/10' : ''}`}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono text-gray-600 dark:text-gray-400">
                            #{booking._id?.slice(-8).toUpperCase()}
                          </span>
                          {booking.completionDisputed && activeTab === "all" && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                              ⚠️
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="shrink-0 h-8 w-8">
                            {booking.user?.image?.url ? (
                              <img className="h-8 w-8 rounded-full object-cover" src={booking.user.image.url} alt="" />
                            ) : (
                              <div className="h-8 w-8 rounded-full bg-brand-100 dark:bg-brand-900/20 flex items-center justify-center">
                                <span className="text-xs font-medium text-brand-700 dark:text-brand-400">
                                  {booking.user?.firstname?.charAt(0) || "U"}
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="ml-3">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {booking.user?.firstname || "Unknown"} {booking.user?.lastname || ""}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {booking.user?.phone || booking.user?.email || "No contact"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {booking.driver ? (
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-8 w-8">
                              {booking.driver?.image?.url ? (
                                <img className="h-8 w-8 rounded-full object-cover" src={booking.driver.image.url} alt="" />
                              ) : (
                                <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                                  <span className="text-xs font-medium text-green-700 dark:text-green-400">
                                    {booking.driver?.firstname?.charAt(0) || "D"}
                                  </span>
                                </div>
                              )}
                            </div>
                            <div className="ml-3">
                              <div className="text-sm font-medium text-gray-900 dark:text-white">
                                {booking.driver?.firstname || "Unknown"} {booking.driver?.lastname || ""}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {booking.tricycle?.plateNumber || "No tricycle"}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400 dark:text-gray-500 italic">No driver yet</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-gray-900 dark:text-white">
                          {formatCurrency(booking.agreedFare || booking.preferredFare)}
                        </div>
                        {booking.driverOffer?.amount && booking.driverOffer.amount !== booking.preferredFare && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            Offered: {formatCurrency(booking.preferredFare)}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${bookingStatuses[booking.status]?.color}`}>
                          {bookingStatuses[booking.status]?.label || booking.status}
                        </span>
                      </td>
                      {activeTab === "disputes" && (
                        <td className="px-6 py-4">
                          <div className="max-w-xs">
                            <p className="text-sm text-orange-700 dark:text-orange-400 truncate" title={booking.disputeReason}>
                              {booking.disputeReason || "No reason provided"}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {formatDateTime(booking.disputedAt)}
                            </p>
                          </div>
                        </td>
                      )}
                      {activeTab === "all" && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          {booking.rating ? (
                            <div className="flex items-center gap-1">
                              <svg className="h-4 w-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                              </svg>
                              <span className="text-sm text-gray-900 dark:text-white">{booking.rating}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400 dark:text-gray-500">-</span>
                          )}
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {formatDate(booking.createdAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleViewBooking(booking._id)}
                          className="text-brand-600 hover:text-brand-900 dark:text-brand-400 dark:hover:text-brand-300"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between">
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Page {page} of {pages}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(pages, p + 1))}
                    disabled={page === pages}
                    className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Booking Details Modal */}
      <Modal isOpen={isDetailsOpen} onClose={handleCloseDetails} className="max-w-[900px] p-6 lg:p-8">
        {detailsLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-500"></div>
          </div>
        ) : selectedBooking ? (
          <div className="overflow-y-auto custom-scrollbar max-h-[85vh]">
            <div className="mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-gray-800 dark:text-white">Booking Details</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 font-mono">
                    ID: {selectedBooking._id}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {selectedBooking.completionDisputed && (
                    <span className="inline-flex px-3 py-1 rounded-full text-sm font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                      ⚠️ Disputed
                    </span>
                  )}
                  <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${bookingStatuses[selectedBooking.status]?.color}`}>
                    {bookingStatuses[selectedBooking.status]?.label || selectedBooking.status}
                  </span>
                </div>
              </div>
            </div>

            {/* Dispute Alert */}
            {selectedBooking.completionDisputed && (
              <div className="mb-6 p-4 bg-orange-50 dark:bg-orange-900/20 rounded-xl border border-orange-200 dark:border-orange-800">
                <div className="flex items-start gap-3">
                  <div className="shrink-0 w-10 h-10 bg-orange-100 dark:bg-orange-900/50 rounded-full flex items-center justify-center">
                    <svg className="h-5 w-5 text-orange-600 dark:text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-orange-800 dark:text-orange-300">Completion Disputed by Passenger</h4>
                    <p className="text-sm text-orange-700 dark:text-orange-400 mt-1">
                      <span className="font-medium">Reason:</span> {selectedBooking.disputeReason || "No reason provided"}
                    </p>
                    <p className="text-xs text-orange-600 dark:text-orange-500 mt-1">
                      Disputed at: {formatDateTime(selectedBooking.disputedAt)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Passenger and Driver Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Passenger */}
              <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                <h4 className="text-sm font-semibold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
                  <svg className="h-4 w-4 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Passenger
                </h4>
                <div className="flex items-center gap-3">
                  {selectedBooking.user?.image?.url ? (
                    <img className="h-12 w-12 rounded-full object-cover" src={selectedBooking.user.image.url} alt="" />
                  ) : (
                    <div className="h-12 w-12 rounded-full bg-brand-100 dark:bg-brand-900/20 flex items-center justify-center">
                      <span className="text-lg font-medium text-brand-700 dark:text-brand-400">
                        {selectedBooking.user?.firstname?.charAt(0) || "U"}
                      </span>
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-gray-800 dark:text-white">
                      {selectedBooking.user?.firstname} {selectedBooking.user?.lastname}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{selectedBooking.user?.email}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{selectedBooking.user?.phone || "No phone"}</p>
                  </div>
                </div>
              </div>

              {/* Driver */}
              <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                <h4 className="text-sm font-semibold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
                  <svg className="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Driver
                </h4>
                {selectedBooking.driver ? (
                  <div className="flex items-center gap-3">
                    {selectedBooking.driver?.image?.url ? (
                      <img className="h-12 w-12 rounded-full object-cover" src={selectedBooking.driver.image.url} alt="" />
                    ) : (
                      <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                        <span className="text-lg font-medium text-green-700 dark:text-green-400">
                          {selectedBooking.driver?.firstname?.charAt(0) || "D"}
                        </span>
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-gray-800 dark:text-white">
                        {selectedBooking.driver?.firstname} {selectedBooking.driver?.lastname}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{selectedBooking.driver?.email}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{selectedBooking.driver?.phone || "No phone"}</p>
                      {selectedBooking.tricycle && (
                        <p className="text-sm font-medium text-green-600 dark:text-green-400">
                          Tricycle: {selectedBooking.tricycle.plateNumber}
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-400 dark:text-gray-500 italic">No driver assigned</p>
                )}
              </div>
            </div>

            {/* Fare and Distance */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl text-center">
                <p className="text-xs text-green-600 dark:text-green-400 mb-1">Agreed Fare</p>
                <p className="text-xl font-bold text-green-700 dark:text-green-300">
                  {formatCurrency(selectedBooking.agreedFare)}
                </p>
              </div>
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl text-center">
                <p className="text-xs text-blue-600 dark:text-blue-400 mb-1">Preferred Fare</p>
                <p className="text-xl font-bold text-blue-700 dark:text-blue-300">
                  {formatCurrency(selectedBooking.preferredFare)}
                </p>
              </div>
              {selectedBooking.driverOffer?.amount && (
                <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl text-center">
                  <p className="text-xs text-purple-600 dark:text-purple-400 mb-1">Driver Offer</p>
                  <p className="text-xl font-bold text-purple-700 dark:text-purple-300">
                    {formatCurrency(selectedBooking.driverOffer.amount)}
                  </p>
                </div>
              )}
              <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl text-center">
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Est. Distance</p>
                <p className="text-xl font-bold text-gray-700 dark:text-gray-300">
                  {formatDistance(selectedBooking.estimatedDistance)}
                </p>
              </div>
            </div>

            {/* Locations */}
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-gray-800 dark:text-white mb-3">Trip Route</h4>
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-900/10 rounded-lg border-l-4 border-green-500">
                  <div className="flex-shrink-0 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                    <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-green-600 dark:text-green-400 uppercase">Pickup Location</p>
                    <p className="text-sm text-gray-800 dark:text-white">
                      {selectedBooking.pickup?.address || `${selectedBooking.pickup?.latitude?.toFixed(6)}, ${selectedBooking.pickup?.longitude?.toFixed(6)}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-900/10 rounded-lg border-l-4 border-red-500">
                  <div className="flex-shrink-0 w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                    <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-red-600 dark:text-red-400 uppercase">Destination</p>
                    <p className="text-sm text-gray-800 dark:text-white">
                      {selectedBooking.destination?.address || `${selectedBooking.destination?.latitude?.toFixed(6)}, ${selectedBooking.destination?.longitude?.toFixed(6)}`}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Timestamps */}
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-gray-800 dark:text-white mb-3">Timeline</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Created</p>
                  <p className="text-sm font-medium text-gray-800 dark:text-white">{formatDateTime(selectedBooking.createdAt)}</p>
                </div>
                {selectedBooking.acceptedAt && (
                  <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Accepted</p>
                    <p className="text-sm font-medium text-gray-800 dark:text-white">{formatDateTime(selectedBooking.acceptedAt)}</p>
                  </div>
                )}
                {selectedBooking.startedAt && (
                  <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Started</p>
                    <p className="text-sm font-medium text-gray-800 dark:text-white">{formatDateTime(selectedBooking.startedAt)}</p>
                  </div>
                )}
                {selectedBooking.completedAt && (
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <p className="text-xs text-green-600 dark:text-green-400">Completed</p>
                    <p className="text-sm font-medium text-green-800 dark:text-green-300">{formatDateTime(selectedBooking.completedAt)}</p>
                  </div>
                )}
                {selectedBooking.cancelledAt && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <p className="text-xs text-red-600 dark:text-red-400">Cancelled</p>
                    <p className="text-sm font-medium text-red-800 dark:text-red-300">{formatDateTime(selectedBooking.cancelledAt)}</p>
                  </div>
                )}
                <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Expires</p>
                  <p className="text-sm font-medium text-gray-800 dark:text-white">{formatDateTime(selectedBooking.expiresAt)}</p>
                </div>
              </div>
            </div>

            {/* Rating and Review */}
            {selectedBooking.rating && (
              <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/10 rounded-xl">
                <h4 className="text-sm font-semibold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
                  <svg className="h-4 w-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  Rating & Review
                </h4>
                <div className="flex items-center gap-2 mb-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <svg
                      key={star}
                      className={`h-5 w-5 ${star <= selectedBooking.rating ? 'text-yellow-400' : 'text-gray-300 dark:text-gray-600'}`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                  <span className="text-lg font-semibold text-gray-800 dark:text-white ml-2">{selectedBooking.rating}/5</span>
                </div>
                {selectedBooking.ratingComment && (
                  <p className="text-sm text-gray-600 dark:text-gray-300 italic">"{selectedBooking.ratingComment}"</p>
                )}
              </div>
            )}

            {/* Cancellation Info */}
            {selectedBooking.status === 'cancelled' && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-200 dark:border-red-800">
                <h4 className="text-sm font-semibold text-red-800 dark:text-red-300 mb-2">Cancellation Info</h4>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  <span className="font-medium">Cancelled by:</span> {selectedBooking.cancelledBy || "Unknown"}
                </p>
                {selectedBooking.cancellationReason && (
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                    <span className="font-medium">Reason:</span> {selectedBooking.cancellationReason}
                  </p>
                )}
              </div>
            )}

            {/* Confirmation Status */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className={`p-3 rounded-lg ${selectedBooking.userConfirmedCompletion ? 'bg-green-50 dark:bg-green-900/20' : 'bg-gray-50 dark:bg-gray-800/50'}`}>
                <p className="text-xs text-gray-500 dark:text-gray-400">User Confirmed</p>
                <p className={`text-sm font-medium ${selectedBooking.userConfirmedCompletion ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}`}>
                  {selectedBooking.userConfirmedCompletion ? 'Yes' : 'No'}
                </p>
              </div>
              <div className={`p-3 rounded-lg ${selectedBooking.driverConfirmedCompletion ? 'bg-green-50 dark:bg-green-900/20' : 'bg-gray-50 dark:bg-gray-800/50'}`}>
                <p className="text-xs text-gray-500 dark:text-gray-400">Driver Confirmed</p>
                <p className={`text-sm font-medium ${selectedBooking.driverConfirmedCompletion ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}`}>
                  {selectedBooking.driverConfirmedCompletion ? 'Yes' : 'No'}
                </p>
              </div>
            </div>

            {/* Close Button */}
            <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={handleCloseDetails}
                className="px-6 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 dark:text-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <div className="py-10 text-center text-gray-500 dark:text-gray-400">
            Booking not found
          </div>
        )}
      </Modal>
    </>
  );
};

export default Bookings;
