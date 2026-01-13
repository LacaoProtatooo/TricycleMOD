import { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Modal } from "../components/ui/modal";
import { useModal } from "../hooks/useModal";
import PageMeta from "../components/common/PageMeta";
import PageBreadcrumb from "../components/common/PageBreadCrumb";
import {
  fetchCodingData,
  updateCodingDay,
  fetchCodingStats,
  fetchOperatorsForFilter,
} from "../redux/actions/codingAction";
import {
  clearUpdateStatus,
  resetCodingFilters,
  DAYS_OF_WEEK,
  DAYS_SHORT,
  isTodayCodingDay,
  getCodingDayName,
} from "../redux/reducers/codingReducer";

const Coding = () => {
  const dispatch = useDispatch();
  const {
    tricycles,
    operators,
    total,
    page,
    pages,
    loading,
    error,
    stats,
    statsLoading,
    updateLoading,
    updateSuccess,
    updateError,
  } = useSelector((state) => state.coding);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [operatorFilter, setOperatorFilter] = useState("");
  const [codingDayFilter, setCodingDayFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Edit modal state
  const [selectedTricycle, setSelectedTricycle] = useState(null);
  const [newCodingDay, setNewCodingDay] = useState("");

  const { isOpen: isEditOpen, openModal: openEditModal, closeModal: closeEditModal } = useModal();

  // Fetch data on mount and filter change
  useEffect(() => {
    dispatch(fetchCodingData({
      page: currentPage,
      limit: 50,
      search: searchQuery,
      operatorId: operatorFilter,
      codingDay: codingDayFilter,
    }));
  }, [dispatch, currentPage, searchQuery, operatorFilter, codingDayFilter]);

  // Fetch stats and operators on mount
  useEffect(() => {
    dispatch(fetchCodingStats());
    dispatch(fetchOperatorsForFilter());
  }, [dispatch]);

  // Handle update success
  useEffect(() => {
    if (updateSuccess) {
      closeEditModal();
      setSelectedTricycle(null);
      setNewCodingDay("");
      dispatch(clearUpdateStatus());
      dispatch(fetchCodingStats());
    }
  }, [updateSuccess, dispatch]);

  const handleEditCoding = (tricycle) => {
    setSelectedTricycle(tricycle);
    setNewCodingDay(tricycle.codingDay !== null && tricycle.codingDay !== undefined ? tricycle.codingDay.toString() : "");
    openEditModal();
  };

  const handleCloseEdit = () => {
    closeEditModal();
    setSelectedTricycle(null);
    setNewCodingDay("");
    dispatch(clearUpdateStatus());
  };

  const handleSaveCodingDay = () => {
    if (!selectedTricycle) return;
    
    const codingDayValue = newCodingDay === "" ? null : parseInt(newCodingDay, 10);
    dispatch(updateCodingDay({
      tricycleId: selectedTricycle._id,
      codingDay: codingDayValue,
    }));
  };

  const handleSearch = (e) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setSearchQuery("");
    setOperatorFilter("");
    setCodingDayFilter("");
    setCurrentPage(1);
    dispatch(resetCodingFilters());
  };

  // Get today's day
  const todayDay = new Date().getDay();

  // Group tricycles by operator for display
  const groupedByOperator = tricycles.reduce((acc, tricycle) => {
    const operatorId = tricycle.operator?._id || "unknown";
    if (!acc[operatorId]) {
      acc[operatorId] = {
        operator: tricycle.operator,
        tricycles: [],
      };
    }
    acc[operatorId].tricycles.push(tricycle);
    return acc;
  }, {});

  // Get coding day badge color
  const getCodingDayBadgeColor = (codingDay) => {
    if (codingDay === null || codingDay === undefined) {
      return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
    }
    if (isTodayCodingDay(codingDay)) {
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    }
    // Different colors for each day
    const colors = {
      0: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400", // Sunday
      1: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400", // Monday
      2: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400", // Tuesday
      3: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", // Wednesday
      4: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400", // Thursday
      5: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400", // Friday
      6: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400", // Saturday
    };
    return colors[codingDay] || "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
  };

  return (
    <>
      <PageMeta
        title="Tricycle Coding Management | TricycleMOD Admin"
        description="Manage number coding assignments for tricycles"
      />
      <PageBreadcrumb pageTitle="Tricycle Coding" />

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex flex-col">
            <p className="text-2xl font-semibold text-gray-800 dark:text-white">
              {statsLoading ? "..." : stats?.totalTricycles || 0}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Total Tricycles</p>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex flex-col">
            <p className="text-2xl font-semibold text-green-600 dark:text-green-400">
              {statsLoading ? "..." : stats?.withCoding || 0}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">With Coding</p>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex flex-col">
            <p className="text-2xl font-semibold text-yellow-600 dark:text-yellow-400">
              {statsLoading ? "..." : stats?.withoutCoding || 0}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">No Coding</p>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex flex-col">
            <p className="text-2xl font-semibold text-red-600 dark:text-red-400">
              {statsLoading ? "..." : stats?.codingToday || 0}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Coding Today ({DAYS_SHORT[todayDay]})</p>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex flex-col">
            <p className="text-2xl font-semibold text-blue-600 dark:text-blue-400">
              {statsLoading ? "..." : stats?.operatorCount || 0}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Operators</p>
          </div>
        </div>

        {/* Day distribution mini chart */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Distribution by Day</p>
          <div className="flex gap-1 items-end h-8">
            {Object.entries(DAYS_SHORT).map(([day, shortName]) => {
              const count = stats?.dayDistribution?.[day] || 0;
              const maxCount = Math.max(...Object.values(stats?.dayDistribution || {}), 1);
              const height = (count / maxCount) * 100;
              const isToday = parseInt(day) === todayDay;
              return (
                <div
                  key={day}
                  className="flex-1 flex flex-col items-center"
                  title={`${DAYS_OF_WEEK[day]}: ${count}`}
                >
                  <div
                    className={`w-full rounded-t ${isToday ? 'bg-red-500' : 'bg-brand-500'}`}
                    style={{ height: `${Math.max(height, 10)}%` }}
                  />
                  <span className={`text-[8px] mt-0.5 ${isToday ? 'text-red-600 font-bold' : 'text-gray-400'}`}>
                    {shortName[0]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        {/* Header with Filters */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-800">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Tricycle Coding Schedule</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {total} tricycles found • Today is <span className="font-medium text-brand-600">{DAYS_OF_WEEK[todayDay]}</span>
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              {/* Search */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search plate/body number..."
                  value={searchQuery}
                  onChange={handleSearch}
                  className="h-10 w-full sm:w-52 rounded-lg border border-gray-300 bg-transparent pl-10 pr-4 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30"
                />
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>

              {/* Operator Filter */}
              <select
                value={operatorFilter}
                onChange={(e) => { setOperatorFilter(e.target.value); setCurrentPage(1); }}
                className="h-10 rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
              >
                <option value="">All Operators</option>
                {operators.map((op) => (
                  <option key={op._id} value={op._id}>
                    {op.firstname} {op.lastname}
                  </option>
                ))}
              </select>

              {/* Coding Day Filter */}
              <select
                value={codingDayFilter}
                onChange={(e) => { setCodingDayFilter(e.target.value); setCurrentPage(1); }}
                className="h-10 rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
              >
                <option value="">All Days</option>
                <option value="none">No Coding Assigned</option>
                {Object.entries(DAYS_OF_WEEK).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label} {parseInt(value) === todayDay ? "(Today)" : ""}
                  </option>
                ))}
              </select>

              {/* Clear Filters */}
              {(searchQuery || operatorFilter || codingDayFilter) && (
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
        ) : tricycles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500 dark:text-gray-400">
            <svg className="h-16 w-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-lg font-medium">No tricycles found</p>
            <p className="text-sm">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="p-6">
            {/* Grouped by Operator */}
            {Object.values(groupedByOperator).map(({ operator, tricycles: opTricycles }) => (
              <div key={operator?._id || "unknown"} className="mb-8 last:mb-0">
                {/* Operator Header */}
                <div className="flex items-center gap-3 mb-4 pb-2 border-b border-gray-200 dark:border-gray-700">
                  {operator?.image?.url ? (
                    <img
                      className="h-10 w-10 rounded-full object-cover"
                      src={operator.image.url}
                      alt=""
                    />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-brand-100 dark:bg-brand-900/20 flex items-center justify-center">
                      <span className="text-sm font-medium text-brand-700 dark:text-brand-400">
                        {operator?.firstname?.[0]}{operator?.lastname?.[0]}
                      </span>
                    </div>
                  )}
                  <div>
                    <h4 className="font-semibold text-gray-800 dark:text-white">
                      {operator?.firstname} {operator?.lastname}
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {operator?.email} • {opTricycles.length} tricycle(s)
                    </p>
                  </div>
                </div>

                {/* Tricycles Table */}
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <th className="pb-3 pr-4">Plate Number</th>
                        <th className="pb-3 pr-4">Body Number</th>
                        <th className="pb-3 pr-4">Model</th>
                        <th className="pb-3 pr-4">Assigned Driver</th>
                        <th className="pb-3 pr-4">Coding Day</th>
                        <th className="pb-3 pr-4">Status</th>
                        <th className="pb-3">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {opTricycles.map((tricycle) => (
                        <tr key={tricycle._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <td className="py-3 pr-4">
                            <span className="font-mono font-semibold text-gray-800 dark:text-white">
                              {tricycle.plateNumber}
                            </span>
                          </td>
                          <td className="py-3 pr-4">
                            <span className="font-mono text-gray-600 dark:text-gray-400">
                              {tricycle.bodyNumber || "—"}
                            </span>
                          </td>
                          <td className="py-3 pr-4 text-gray-600 dark:text-gray-400">
                            {tricycle.model}
                          </td>
                          <td className="py-3 pr-4">
                            {tricycle.driver ? (
                              <div className="flex items-center gap-2">
                                {tricycle.driver.image?.url ? (
                                  <img
                                    className="h-6 w-6 rounded-full object-cover"
                                    src={tricycle.driver.image.url}
                                    alt=""
                                  />
                                ) : (
                                  <div className="h-6 w-6 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                                    <span className="text-xs text-gray-500">
                                      {tricycle.driver.firstname?.[0]}
                                    </span>
                                  </div>
                                )}
                                <span className="text-sm text-gray-800 dark:text-white">
                                  {tricycle.driver.firstname} {tricycle.driver.lastname}
                                </span>
                              </div>
                            ) : (
                              <span className="text-sm text-gray-400 italic">Unassigned</span>
                            )}
                          </td>
                          <td className="py-3 pr-4">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getCodingDayBadgeColor(tricycle.codingDay)}`}>
                              {getCodingDayName(tricycle.codingDay)}
                              {isTodayCodingDay(tricycle.codingDay) && (
                                <span className="ml-1 text-[10px]">🚫</span>
                              )}
                            </span>
                          </td>
                          <td className="py-3 pr-4">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              tricycle.status === 'available'
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                            }`}>
                              {tricycle.status}
                            </span>
                          </td>
                          <td className="py-3">
                            <button
                              onClick={() => handleEditCoding(tricycle)}
                              className="text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 text-sm font-medium"
                            >
                              Edit
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}

            {/* Pagination */}
            {pages > 1 && (
              <div className="flex items-center justify-between pt-6 border-t border-gray-200 dark:border-gray-700 mt-6">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Page {page} of {pages} ({total} total)
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={page === 1}
                    className="px-3 py-1 rounded border border-gray-300 dark:border-gray-700 text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, pages))}
                    disabled={page === pages}
                    className="px-3 py-1 rounded border border-gray-300 dark:border-gray-700 text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit Coding Day Modal */}
      <Modal isOpen={isEditOpen} onClose={handleCloseEdit} className="max-w-md">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
            Edit Coding Day
          </h3>

          {selectedTricycle && (
            <div className="mb-6">
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="text-sm text-gray-500 dark:text-gray-400">Tricycle</p>
                <p className="font-mono font-semibold text-lg text-gray-800 dark:text-white">
                  {selectedTricycle.plateNumber}
                </p>
                {selectedTricycle.bodyNumber && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Body: {selectedTricycle.bodyNumber}
                  </p>
                )}
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Operator: {selectedTricycle.operator?.firstname} {selectedTricycle.operator?.lastname}
                </p>
                {selectedTricycle.driver && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Driver: {selectedTricycle.driver?.firstname} {selectedTricycle.driver?.lastname}
                  </p>
                )}
              </div>
            </div>
          )}

          {updateError && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg text-sm dark:bg-red-900/20 dark:border-red-700 dark:text-red-400">
              {updateError}
            </div>
          )}

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Coding Day
            </label>
            <select
              value={newCodingDay}
              onChange={(e) => setNewCodingDay(e.target.value)}
              className="w-full h-11 rounded-lg border border-gray-300 bg-transparent px-4 text-gray-800 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
            >
              <option value="">None (No Coding Day)</option>
              {Object.entries(DAYS_OF_WEEK).map(([value, label]) => (
                <option key={value} value={value}>
                  {label} {parseInt(value) === todayDay ? "(Today)" : ""}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Select the day when this tricycle cannot operate due to number coding restrictions.
            </p>
          </div>

          <div className="flex gap-3 justify-end">
            <button
              onClick={handleCloseEdit}
              className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 dark:text-gray-400 dark:bg-gray-800 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveCodingDay}
              disabled={updateLoading}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {updateLoading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default Coding;
