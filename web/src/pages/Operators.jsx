import { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Modal } from "../components/ui/modal";
import { useModal } from "../hooks/useModal";
import PageMeta from "../components/common/PageMeta";
import PageBreadcrumb from "../components/common/PageBreadCrumb";
import MaintenanceHistoryModal from "../components/MaintenanceHistoryModal";
import {
  fetchAllOperators,
  fetchOperatorDetails,
  fetchOperatorStats,
} from "../redux/actions/operatorAction";
import {
  clearSelectedOperator,
  resetOperatorFilters,
} from "../redux/reducers/operatorReducer";

const Operators = () => {
  const dispatch = useDispatch();
  const {
    operators,
    total,
    page,
    pages,
    loading,
    error,
    selectedOperator,
    selectedTricycles,
    detailsLoading,
    stats,
    statsLoading,
  } = useSelector((state) => state.operator);

  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [maintenanceTricycle, setMaintenanceTricycle] = useState(null);

  const { isOpen: isDetailsOpen, openModal: openDetailsModal, closeModal: closeDetailsModal } = useModal();
  const { isOpen: isMaintenanceOpen, openModal: openMaintenanceModal, closeModal: closeMaintenanceModal } = useModal();

  // Fetch operators on mount and filter change
  useEffect(() => {
    dispatch(fetchAllOperators({
      page: currentPage,
      limit: 20,
      search: searchQuery,
    }));
  }, [dispatch, currentPage, searchQuery]);

  // Fetch stats on mount
  useEffect(() => {
    dispatch(fetchOperatorStats());
  }, [dispatch]);

  const handleViewOperator = (operatorId) => {
    dispatch(fetchOperatorDetails(operatorId));
    openDetailsModal();
  };

  const handleCloseDetails = () => {
    closeDetailsModal();
    dispatch(clearSelectedOperator());
  };

  const handleViewMaintenance = (tricycle, e) => {
    e.stopPropagation();
    setMaintenanceTricycle(tricycle);
    openMaintenanceModal();
  };

  const handleCloseMaintenanceModal = () => {
    closeMaintenanceModal();
    setMaintenanceTricycle(null);
  };

  const handleSearch = (e) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setSearchQuery("");
    setCurrentPage(1);
    dispatch(resetOperatorFilters());
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <>
      <PageMeta
        title="Operators Management | TricycleMOD Admin"
        description="Manage and monitor all operators, tricycles and drivers"
      />
      <PageBreadcrumb pageTitle="Operators Management" />

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex flex-col">
            <p className="text-2xl font-semibold text-gray-800 dark:text-white">
              {statsLoading ? "..." : stats?.totalOperators || 0}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Total Operators</p>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex flex-col">
            <p className="text-2xl font-semibold text-green-600 dark:text-green-400">
              {statsLoading ? "..." : stats?.verifiedOperators || 0}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Verified</p>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex flex-col">
            <p className="text-2xl font-semibold text-blue-600 dark:text-blue-400">
              {statsLoading ? "..." : stats?.newOperators || 0}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">New (30 days)</p>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex flex-col">
            <p className="text-2xl font-semibold text-purple-600 dark:text-purple-400">
              {statsLoading ? "..." : stats?.totalTricycles || 0}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Total Tricycles</p>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex flex-col">
            <p className="text-2xl font-semibold text-cyan-600 dark:text-cyan-400">
              {statsLoading ? "..." : stats?.assignedTricycles || 0}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Assigned</p>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex flex-col">
            <p className="text-2xl font-semibold text-yellow-600 dark:text-yellow-400">
              {statsLoading ? "..." : stats?.unassignedTricycles || 0}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Unassigned</p>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex flex-col">
            <p className="text-2xl font-semibold text-brand-600 dark:text-brand-400">
              {statsLoading ? "..." : stats?.totalDrivers || 0}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Total Drivers</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        {/* Header with Search */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-800">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white">All Operators</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {total} operators found
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              {/* Search */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search operators..."
                  value={searchQuery}
                  onChange={handleSearch}
                  className="h-10 w-full sm:w-64 rounded-lg border border-gray-300 bg-transparent pl-10 pr-4 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30"
                />
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>

              {/* Clear Filters */}
              {searchQuery && (
                <button
                  onClick={clearFilters}
                  className="h-10 px-4 rounded-lg text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 dark:text-gray-400 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
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
        ) : operators.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500 dark:text-gray-400">
            <svg className="h-16 w-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <p className="text-lg font-medium">No operators found</p>
            <p className="text-sm">Try adjusting your search</p>
          </div>
        ) : (
          <>
            {/* Operators Grid */}
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {operators.map((operator) => (
                <div
                  key={operator._id}
                  className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => handleViewOperator(operator._id)}
                >
                  {/* Operator Header */}
                  <div className="flex items-center gap-3 mb-4">
                    {operator.image?.url ? (
                      <img
                        className="h-12 w-12 rounded-full object-cover"
                        src={operator.image.url}
                        alt=""
                      />
                    ) : (
                      <div className="h-12 w-12 rounded-full bg-brand-100 dark:bg-brand-900/20 flex items-center justify-center">
                        <span className="text-lg font-medium text-brand-700 dark:text-brand-400">
                          {operator.firstname?.charAt(0) || "O"}
                        </span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                        {operator.firstname} {operator.lastname}
                      </h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {operator.email}
                      </p>
                    </div>
                    {operator.isVerified ? (
                      <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        Verified
                      </span>
                    ) : (
                      <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                        Pending
                      </span>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className="text-center p-2 bg-white dark:bg-gray-900/50 rounded-lg">
                      <p className="text-lg font-semibold text-purple-600 dark:text-purple-400">
                        {operator.stats?.totalTricycles || 0}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Tricycles</p>
                    </div>
                    <div className="text-center p-2 bg-white dark:bg-gray-900/50 rounded-lg">
                      <p className="text-lg font-semibold text-cyan-600 dark:text-cyan-400">
                        {operator.stats?.activeTricycles || 0}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Active</p>
                    </div>
                    <div className="text-center p-2 bg-white dark:bg-gray-900/50 rounded-lg">
                      <p className="text-lg font-semibold text-brand-600 dark:text-brand-400">
                        {operator.stats?.driversCount || 0}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Drivers</p>
                    </div>
                  </div>

                  {/* Tricycles Preview */}
                  {operator.tricycles && operator.tricycles.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Tricycles:</p>
                      <div className="flex flex-wrap gap-1">
                        {operator.tricycles.slice(0, 4).map((tricycle) => (
                          <span
                            key={tricycle._id}
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              tricycle.driver
                                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
                            }`}
                          >
                            {tricycle.plateNumber}
                          </span>
                        ))}
                        {operator.tricycles.length > 4 && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                            +{operator.tricycles.length - 4} more
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 dark:text-gray-500 italic">No tricycles registered</p>
                  )}

                  {/* Footer */}
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Joined {formatDate(operator.createdAt)}
                    </span>
                    <button className="text-xs text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 font-medium">
                      View Details
                    </button>
                  </div>
                </div>
              ))}
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

      {/* Operator Details Modal */}
      <Modal isOpen={isDetailsOpen} onClose={handleCloseDetails} className="max-w-[1000px] p-6 lg:p-8">
        {detailsLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-500"></div>
          </div>
        ) : selectedOperator ? (
          <div className="overflow-y-auto custom-scrollbar max-h-[85vh]">
            {/* Header */}
            <div className="mb-6">
              <div className="flex items-center gap-4">
                {selectedOperator.image?.url ? (
                  <img
                    className="h-16 w-16 rounded-full object-cover"
                    src={selectedOperator.image.url}
                    alt=""
                  />
                ) : (
                  <div className="h-16 w-16 rounded-full bg-brand-100 dark:bg-brand-900/20 flex items-center justify-center">
                    <span className="text-2xl font-medium text-brand-700 dark:text-brand-400">
                      {selectedOperator.firstname?.charAt(0) || "O"}
                    </span>
                  </div>
                )}
                <div>
                  <h3 className="text-xl font-semibold text-gray-800 dark:text-white">
                    {selectedOperator.firstname} {selectedOperator.lastname}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{selectedOperator.email}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {selectedOperator.isVerified ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        Verified
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
                        Not Verified
                      </span>
                    )}
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Joined {formatDate(selectedOperator.createdAt)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Contact Info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                <p className="text-xs text-gray-500 dark:text-gray-400">Username</p>
                <p className="text-sm font-medium text-gray-800 dark:text-white">@{selectedOperator.username}</p>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                <p className="text-xs text-gray-500 dark:text-gray-400">Phone</p>
                <p className="text-sm font-medium text-gray-800 dark:text-white">{selectedOperator.phone || "Not provided"}</p>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                <p className="text-xs text-gray-500 dark:text-gray-400">Address</p>
                <p className="text-sm font-medium text-gray-800 dark:text-white">
                  {selectedOperator.address?.city || "Not provided"}
                </p>
              </div>
            </div>

            {/* Tricycles Section */}
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
                <svg className="h-4 w-4 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                Registered Tricycles ({selectedTricycles?.length || 0})
              </h4>

              {selectedTricycles && selectedTricycles.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {selectedTricycles.map((tricycle) => (
                    <div
                      key={tricycle._id}
                      className={`p-4 rounded-lg border ${
                        tricycle.driver
                          ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/10"
                          : "border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50"
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h5 className="text-sm font-semibold text-gray-900 dark:text-white">
                            {tricycle.plateNumber}
                          </h5>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {tricycle.model} • Body #{tricycle.bodyNumber || "N/A"}
                          </p>
                        </div>
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                            tricycle.status === "available"
                              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                              : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
                          }`}
                        >
                          {tricycle.status}
                        </span>
                      </div>

                      {/* Driver Info */}
                      {tricycle.driver ? (
                        <div className="flex items-center gap-2 p-2 bg-white dark:bg-gray-900/50 rounded-lg mt-2">
                          {tricycle.driver.image?.url ? (
                            <img
                              className="h-8 w-8 rounded-full object-cover"
                              src={tricycle.driver.image.url}
                              alt=""
                            />
                          ) : (
                            <div className="h-8 w-8 rounded-full bg-cyan-100 dark:bg-cyan-900/20 flex items-center justify-center">
                              <span className="text-xs font-medium text-cyan-700 dark:text-cyan-400">
                                {tricycle.driver.firstname?.charAt(0) || "D"}
                              </span>
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-900 dark:text-white truncate">
                              {tricycle.driver.firstname} {tricycle.driver.lastname}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                              {tricycle.driver.email}
                            </p>
                          </div>
                          <div className="text-right">
                            <div className="flex items-center gap-1">
                              <svg className="h-3 w-3 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                              </svg>
                              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                {tricycle.driver.rating?.toFixed(1) || "0.0"}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {tricycle.driver.numReviews || 0} reviews
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="p-2 bg-white dark:bg-gray-900/50 rounded-lg mt-2 text-center">
                          <p className="text-xs text-gray-400 dark:text-gray-500 italic">No driver assigned</p>
                        </div>
                      )}

                      {/* Odometer */}
                      <div className="mt-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                        <span>Odometer: {tricycle.currentOdometer?.toLocaleString() || 0} km</span>
                        <button
                          onClick={(e) => handleViewMaintenance(tricycle, e)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded transition-colors"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          Maintenance
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 text-center bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                  <p className="text-sm text-gray-500 dark:text-gray-400">No tricycles registered</p>
                </div>
              )}
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
            Operator not found
          </div>
        )}
      </Modal>

      {/* Maintenance History Modal */}
      <MaintenanceHistoryModal
        isOpen={isMaintenanceOpen}
        onClose={handleCloseMaintenanceModal}
        tricycle={maintenanceTricycle}
      />
    </>
  );
};

export default Operators;
