import { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Modal } from "../components/ui/modal";
import { useModal } from "../hooks/useModal";
import PageMeta from "../components/common/PageMeta";
import PageBreadcrumb from "../components/common/PageBreadCrumb";
import {
  fetchAllLostFound,
  fetchLostFoundStats,
  verifyLostFoundItem,
  deleteLostFoundItem,
} from "../redux/actions/lostFoundAction";
import {
  clearLostFoundError,
  setStatusFilter,
  resetLostFoundFilters,
} from "../redux/reducers/lostFoundReducer";

const LostFound = () => {
  const dispatch = useDispatch();
  const {
    items,
    loading,
    error,
    stats,
    statsLoading,
    verifyLoading,
    deleteLoading,
    statusFilter,
  } = useSelector((state) => state.lostFound);

  // Local state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);
  const [verifyData, setVerifyData] = useState({
    status: "",
    claimerName: "",
    claimerContact: "",
    claimNotes: "",
  });

  // Modals
  const { isOpen: isDetailsOpen, openModal: openDetailsModal, closeModal: closeDetailsModal } = useModal();
  const { isOpen: isVerifyOpen, openModal: openVerifyModal, closeModal: closeVerifyModal } = useModal();
  const { isOpen: isDeleteOpen, openModal: openDeleteModal, closeModal: closeDeleteModal } = useModal();
  const { isOpen: isImageOpen, openModal: openImageModal, closeModal: closeImageModal } = useModal();

  // Status config
  const statusConfig = {
    posted: { label: "Posted", color: "text-yellow-700 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/20" },
    claimed: { label: "Claimed", color: "text-blue-700 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/20" },
    returned: { label: "Returned", color: "text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-900/20" },
  };

  // Fetch data on mount and filter change
  useEffect(() => {
    dispatch(fetchAllLostFound({ status: statusFilter }));
  }, [dispatch, statusFilter]);

  // Fetch stats on mount
  useEffect(() => {
    dispatch(fetchLostFoundStats());
  }, [dispatch]);

  // Filter items by search query
  const filteredItems = items.filter((item) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      item.title?.toLowerCase().includes(searchLower) ||
      item.description?.toLowerCase().includes(searchLower) ||
      item.locationText?.toLowerCase().includes(searchLower) ||
      item.driver?.firstname?.toLowerCase().includes(searchLower) ||
      item.driver?.lastname?.toLowerCase().includes(searchLower)
    );
  });

  const handleViewDetails = (item) => {
    setSelectedItem(item);
    openDetailsModal();
  };

  const handleCloseDetails = () => {
    closeDetailsModal();
    setSelectedItem(null);
  };

  const handleOpenVerify = (item) => {
    setSelectedItem(item);
    setVerifyData({
      status: item.status,
      claimerName: item.claimerName || "",
      claimerContact: item.claimerContact || "",
      claimNotes: item.claimNotes || "",
    });
    openVerifyModal();
  };

  const handleCloseVerify = () => {
    closeVerifyModal();
    setSelectedItem(null);
    setVerifyData({ status: "", claimerName: "", claimerContact: "", claimNotes: "" });
  };

  const handleVerifySubmit = async () => {
    if (!selectedItem) return;
    
    await dispatch(verifyLostFoundItem({
      id: selectedItem._id,
      ...verifyData,
    }));
    
    dispatch(fetchLostFoundStats());
    handleCloseVerify();
  };

  const handleOpenDelete = (item) => {
    setSelectedItem(item);
    openDeleteModal();
  };

  const handleCloseDelete = () => {
    closeDeleteModal();
    setSelectedItem(null);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedItem) return;
    
    await dispatch(deleteLostFoundItem(selectedItem._id));
    dispatch(fetchLostFoundStats());
    handleCloseDelete();
  };

  const handleViewImage = (item) => {
    setSelectedItem(item);
    openImageModal();
  };

  const handleStatusFilter = (status) => {
    dispatch(setStatusFilter(status === statusFilter ? "" : status));
  };

  const clearFilters = () => {
    setSearchQuery("");
    dispatch(resetLostFoundFilters());
  };

  const formatDate = (date) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <>
      <PageMeta title="Lost & Found | Admin Dashboard" description="Manage lost and found items" />
      <PageBreadcrumb pageTitle="Lost & Found" />

      <div className="space-y-6">
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Total Items</p>
                <h3 className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">
                  {statsLoading ? "..." : stats?.total || 0}
                </h3>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/20">
                <svg className="h-6 w-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Posted</p>
                <h3 className="mt-1 text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                  {statsLoading ? "..." : stats?.posted || 0}
                </h3>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900/20">
                <svg className="h-6 w-6 text-yellow-600 dark:text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Claimed</p>
                <h3 className="mt-1 text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {statsLoading ? "..." : stats?.claimed || 0}
                </h3>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/20">
                <svg className="h-6 w-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Returned</p>
                <h3 className="mt-1 text-2xl font-bold text-green-600 dark:text-green-400">
                  {statsLoading ? "..." : stats?.returned || 0}
                </h3>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
                <svg className="h-6 w-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <input
                type="text"
                placeholder="Search items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-transparent py-2.5 pl-10 pr-4 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:text-white"
              />
              <svg className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            {/* Status Filters */}
            <div className="flex flex-wrap items-center gap-2">
              {Object.entries(statusConfig).map(([status, config]) => (
                <button
                  key={status}
                  onClick={() => handleStatusFilter(status)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    statusFilter === status
                      ? config.color
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                  }`}
                >
                  {config.label}
                </button>
              ))}
              {(statusFilter || searchQuery) && (
                <button
                  onClick={clearFilters}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="rounded-lg bg-red-50 p-4 text-red-600 dark:bg-red-900/20 dark:text-red-400">
            {error}
            <button
              onClick={() => dispatch(clearLostFoundError())}
              className="ml-2 underline hover:no-underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Items Table */}
        <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Item</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Posted By</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Location</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Found Date</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Status</th>
                  <th className="px-6 py-4 text-right text-sm font-semibold text-gray-900 dark:text-white">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <div className="flex items-center justify-center">
                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
                      </div>
                    </td>
                  </tr>
                ) : filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                      No lost & found items found
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => (
                    <tr key={item._id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {item.photoUrl ? (
                            <img
                              src={item.photoUrl}
                              alt={item.title}
                              className="h-12 w-12 rounded-lg object-cover cursor-pointer hover:opacity-80"
                              onClick={() => handleViewImage(item)}
                            />
                          ) : (
                            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800">
                              <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{item.title}</p>
                            <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1">
                              {item.description}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {item.driver?.image?.url ? (
                            <img
                              src={item.driver.image.url}
                              alt={item.driver.firstname}
                              className="h-8 w-8 rounded-full object-cover"
                            />
                          ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700">
                              <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                                {item.driver?.firstname?.[0]}{item.driver?.lastname?.[0]}
                              </span>
                            </div>
                          )}
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            {item.driver?.firstname} {item.driver?.lastname}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                        {item.locationText || "Not specified"}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                        {formatDate(item.foundDate)}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusConfig[item.status]?.color || "bg-gray-100 text-gray-700"}`}>
                          {statusConfig[item.status]?.label || item.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleViewDetails(item)}
                            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                            title="View Details"
                          >
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleOpenVerify(item)}
                            className="rounded-lg p-2 text-blue-500 hover:bg-blue-100 hover:text-blue-700 dark:hover:bg-blue-900/20"
                            title="Verify/Update Status"
                          >
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleOpenDelete(item)}
                            className="rounded-lg p-2 text-red-500 hover:bg-red-100 hover:text-red-700 dark:hover:bg-red-900/20"
                            title="Delete"
                          >
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Details Modal */}
      <Modal isOpen={isDetailsOpen} onClose={handleCloseDetails} className="max-w-2xl">
        <div className="p-6">
          <h3 className="mb-4 text-xl font-semibold text-gray-900 dark:text-white">
            Item Details
          </h3>
          {selectedItem && (
            <div className="space-y-4">
              {selectedItem.photoUrl && (
                <div className="flex justify-center">
                  <img
                    src={selectedItem.photoUrl}
                    alt={selectedItem.title}
                    className="max-h-64 rounded-lg object-contain"
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Title</label>
                  <p className="text-gray-900 dark:text-white">{selectedItem.title}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</label>
                  <p>
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusConfig[selectedItem.status]?.color}`}>
                      {statusConfig[selectedItem.status]?.label}
                    </span>
                  </p>
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Description</label>
                  <p className="text-gray-900 dark:text-white">{selectedItem.description}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Location</label>
                  <p className="text-gray-900 dark:text-white">{selectedItem.locationText || "Not specified"}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Found Date</label>
                  <p className="text-gray-900 dark:text-white">{formatDate(selectedItem.foundDate)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Posted By</label>
                  <p className="text-gray-900 dark:text-white">
                    {selectedItem.driver?.firstname} {selectedItem.driver?.lastname}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Posted On</label>
                  <p className="text-gray-900 dark:text-white">{formatDate(selectedItem.createdAt)}</p>
                </div>
                {(selectedItem.status === "claimed" || selectedItem.status === "returned") && (
                  <>
                    <div className="col-span-2 border-t border-gray-200 pt-4 dark:border-gray-700">
                      <h4 className="mb-2 font-medium text-gray-900 dark:text-white">Claim Information</h4>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Claimer Name</label>
                      <p className="text-gray-900 dark:text-white">{selectedItem.claimerName || "N/A"}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Claimer Contact</label>
                      <p className="text-gray-900 dark:text-white">{selectedItem.claimerContact || "N/A"}</p>
                    </div>
                    <div className="col-span-2">
                      <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Claim Notes</label>
                      <p className="text-gray-900 dark:text-white">{selectedItem.claimNotes || "N/A"}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Claimed At</label>
                      <p className="text-gray-900 dark:text-white">{formatDate(selectedItem.claimedAt)}</p>
                    </div>
                  </>
                )}
              </div>
              <div className="flex justify-end pt-4">
                <button
                  onClick={handleCloseDetails}
                  className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Verify Modal */}
      <Modal isOpen={isVerifyOpen} onClose={handleCloseVerify} className="max-w-md">
        <div className="p-6">
          <h3 className="mb-4 text-xl font-semibold text-gray-900 dark:text-white">
            Verify Item Status
          </h3>
          {selectedItem && (
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Item: {selectedItem.title}
                </label>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Status
                </label>
                <select
                  value={verifyData.status}
                  onChange={(e) => setVerifyData({ ...verifyData, status: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 bg-transparent px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:text-white"
                >
                  <option value="posted">Posted</option>
                  <option value="claimed">Claimed</option>
                  <option value="returned">Returned</option>
                </select>
              </div>
              {(verifyData.status === "claimed" || verifyData.status === "returned") && (
                <>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Claimer Name
                    </label>
                    <input
                      type="text"
                      value={verifyData.claimerName}
                      onChange={(e) => setVerifyData({ ...verifyData, claimerName: e.target.value })}
                      placeholder="Enter claimer's name"
                      className="w-full rounded-lg border border-gray-300 bg-transparent px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Claimer Contact
                    </label>
                    <input
                      type="text"
                      value={verifyData.claimerContact}
                      onChange={(e) => setVerifyData({ ...verifyData, claimerContact: e.target.value })}
                      placeholder="Enter claimer's contact"
                      className="w-full rounded-lg border border-gray-300 bg-transparent px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Notes
                    </label>
                    <textarea
                      value={verifyData.claimNotes}
                      onChange={(e) => setVerifyData({ ...verifyData, claimNotes: e.target.value })}
                      placeholder="Add any notes about the claim"
                      rows={3}
                      className="w-full rounded-lg border border-gray-300 bg-transparent px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:text-white"
                    />
                  </div>
                </>
              )}
              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={handleCloseVerify}
                  className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleVerifySubmit}
                  disabled={verifyLoading}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {verifyLoading ? "Updating..." : "Update Status"}
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={isDeleteOpen} onClose={handleCloseDelete} className="max-w-md">
        <div className="p-6">
          <h3 className="mb-4 text-xl font-semibold text-gray-900 dark:text-white">
            Delete Item
          </h3>
          <p className="mb-6 text-gray-600 dark:text-gray-400">
            Are you sure you want to delete "{selectedItem?.title}"? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-3">
            <button
              onClick={handleCloseDelete}
              className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteConfirm}
              disabled={deleteLoading}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {deleteLoading ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Image Preview Modal */}
      <Modal isOpen={isImageOpen} onClose={closeImageModal} className="max-w-4xl">
        <div className="p-4">
          {selectedItem?.photoUrl && (
            <img
              src={selectedItem.photoUrl}
              alt={selectedItem.title}
              className="w-full rounded-lg object-contain"
            />
          )}
        </div>
      </Modal>
    </>
  );
};

export default LostFound;
