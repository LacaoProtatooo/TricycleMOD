import { useState, useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Modal } from "../components/ui/modal";
import { useModal } from "../hooks/useModal";
import PageMeta from "../components/common/PageMeta";
import PageBreadcrumb from "../components/common/PageBreadCrumb";
import {
  fetchAllDrivers,
  fetchDriverDetails,
  verifyDriverLicense,
  rejectDriverLicense,
  deleteDriverLicense,
  fetchLicenseStats,
  suspendDriver,
  reinstateDriver,
} from "../redux/actions/driverAction";
import {
  clearVerifyStatus,
  clearRejectStatus,
  clearDeleteStatus,
  clearSelectedDriver,
  clearSuspendStatus,
  clearReinstateStatus,
} from "../redux/reducers/driverReducer";

// WEBTTODA Suspension Rules Reference
const SUSPENSION_PRESETS = [
  { days: 1, label: "1 Day", description: "Minor offense - 1st violation" },
  { days: 3, label: "3 Days", description: "Standard offense - 1st/2nd violation" },
  { days: 7, label: "1 Week", description: "Serious offense - 1st violation" },
  { days: 14, label: "2 Weeks", description: "Severe offense" },
  { days: 30, label: "1 Month", description: "Major offense or repeated violations" },
];

// WEBTTODA Suspension Rules Reference with full penalties
const WEBTTODA_RULES = [
  // Category I: Work & Drive Efficiency
  { id: 1, category: "Work & Drive Efficiency", rule: "Act of insubordination", offense: "Any act of insubordination", penalties: ["Suspension 3 days", "Suspension 1 week", "Suspension 1 month or dismissal", "Dismissal"], defaultDays: [3, 7, 30, 0] },
  { id: 2, category: "Work & Drive Efficiency", rule: "Illegal lining other than prescribed point", offense: "Illegal lining other than prescribed point", penalties: ["Suspension 3 days", "Suspension 1 week", "Suspension 1 month or dismissal", "Dismissal"], defaultDays: [3, 7, 30, 0] },
  { id: 3, category: "Work & Drive Efficiency", rule: "Illegal pick-up of passengers", offense: "Illegal pick-up of passengers", penalties: ["Suspension 3 days", "Suspension 1 week", "Suspension 1 month or dismissal", "Dismissal"], defaultDays: [3, 7, 30, 0] },
  { id: 4, category: "Work & Drive Efficiency", rule: "Dress code violation (weekdays)", offense: "Wearing sandos, short pants and sandals from Monday to Friday (not authorized except during rainy days)", penalties: ["Suspension 3 days", "Suspension 1 week", "Suspension 1 month or dismissal", "Dismissal"], defaultDays: [3, 7, 30, 0] },
  { id: 5, category: "Work & Drive Efficiency", rule: "Dress code violation (weekends/holidays)", offense: "Wearing sandos during Saturday, Sunday and Holiday (not authorized)", penalties: ["Suspension 3 days", "Suspension 1 week", "Suspension 1 month or dismissal", "Dismissal"], defaultDays: [3, 7, 30, 0] },
  { id: 6, category: "Work & Drive Efficiency", rule: "Wearing slippers/short pants during weekdays", offense: "Wearing slippers and short pants during weekdays", penalties: ["Suspension 3 days", "Suspension 1 week", "Suspension 1 month or dismissal", "Dismissal"], defaultDays: [3, 7, 30, 0] },
  // Category II: Act of Dishonesty
  { id: 7, category: "Act of Dishonesty", rule: "Failure to pay daily dues", offense: "Failure and/or refusing to pay the daily dues", penalties: ["Suspension 1 day", "Suspension 3 days", "Suspension 1 month or dismissal", "Dismissal"], defaultDays: [1, 3, 30, 0] },
  { id: 8, category: "Act of Dishonesty", rule: "False statement/fraudulent entries", offense: "FALSE STATEMENT – Any applicant who had been accepted for membership and later found out to have fraudulent entries in order to 'influence' approval", penalties: ["Dismissal"], defaultDays: [0] },
  // Category III: Act Against Public Policy
  { id: 9, category: "Act Against Public Policy", rule: "Driving under influence/drinking within premises", offense: "Driving under the influence of liquor, drug and/or participating in any drinking spree within the WEBTTODA premises or any form of illegal gambling within the route", penalties: ["Suspension 1 week", "Dismissal"], defaultDays: [7, 0] },
  { id: 10, category: "Act Against Public Policy", rule: "Defacing/tearing posters", offense: "Defacing and/or tearing down posters of the association from bulletin board, or adding insulting words and/or pictures or marks", penalties: ["Suspension 1 week", "Suspension 1 month", "Dismissal"], defaultDays: [7, 30, 0] },
  { id: 11, category: "Act Against Public Policy", rule: "Fighting in the association", offense: "Fighting in the association regardless of the cause", penalties: ["Suspension 1 week", "Dismissal"], defaultDays: [7, 0] },
  { id: 12, category: "Act Against Public Policy", rule: "Attacking another member without provocation", offense: "Attacking another member without any provocation causing bodily harm and/or injury", penalties: ["Suspension 1 week", "Dismissal"], defaultDays: [7, 0] },
  { id: 13, category: "Act Against Public Policy", rule: "Challenging any member to fight", offense: "Challenging any member to fight", penalties: ["Suspension 2 weeks", "Dismissal"], defaultDays: [14, 0] },
  { id: 14, category: "Act Against Public Policy", rule: "Challenging Officers and Trustees", offense: "Challenging Officers and Trustees", penalties: ["Suspension 2 weeks or dismissal", "Dismissal"], defaultDays: [14, 0] },
  { id: 15, category: "Act Against Public Policy", rule: "Discourteous acts against passengers", offense: "Discourteous Acts Committed against passengers within the association playing route area", penalties: ["Suspension 3 days", "Suspension 1 week", "Dismissal"], defaultDays: [3, 7, 0] },
  { id: 16, category: "Act Against Public Policy", rule: "Reckless driving within playing routes", offense: "Reckless driving within the WEBTTODA playing routes", penalties: ["Suspension 1 week or dismissal", "Suspension 1 week"], defaultDays: [7, 7] },
  { id: 17, category: "Act Against Public Policy", rule: "Causing ill-will/dissension among members", offense: "Cause ill-will and dissension or create cliques and/or intrigues among the officers, trustees and members", penalties: ["Suspension 1 week", "Suspension 1 month or dismissal", "Dismissal"], defaultDays: [7, 30, 0] },
  { id: 18, category: "Act Against Public Policy", rule: "Coercing and intimidating members", offense: "Treating coercing and intimidating below members", penalties: ["Suspension 1 week", "Suspension 1 month", "Dismissal"], defaultDays: [7, 30, 0] },
  // Category IV: Serious Offenses
  { id: 19, category: "Serious Offenses", rule: "Conviction of crime (1 month+ penalty)", offense: "Conviction of any crime where the penalty is for one (1) month or more", penalties: ["Dismissal"], defaultDays: [0] },
  { id: 20, category: "Serious Offenses", rule: "Making malicious false accusations", offense: "Making malicious false accusation and statement concerning the good name of the association", penalties: ["Dismissal"], defaultDays: [0] },
  { id: 21, category: "Serious Offenses", rule: "Substituting old parts/appropriating property", offense: "Substituting old parts for operators owned property and appropriating same", penalties: ["Dismissal"], defaultDays: [0] },
  { id: 22, category: "Serious Offenses", rule: "Damaging association property", offense: "Misusing, destroying, defacing and/or damaging association property", penalties: ["Suspension 1 week or Dismissal"], defaultDays: [7] },
  { id: 23, category: "Serious Offenses", rule: "Acts of disrespect to executives", offense: "Acts of disrespect or discourtesy to the association executive", penalties: ["Suspension 1 month", "Dismissal"], defaultDays: [30, 0] },
  { id: 24, category: "Serious Offenses", rule: "Insulting conduct to officers/trustees", offense: "Insulting and/or unbecoming conduct and/or language to the association officers and trustees", penalties: ["Suspension 2 weeks", "Dismissal"], defaultDays: [14, 0] },
  { id: 25, category: "Serious Offenses", rule: "Disobedience to lawful orders of Marshall", offense: "Disobedience to lawful orders of Marshall", penalties: ["Suspension 2 weeks or dismissal", "Dismissal"], defaultDays: [14, 0] },
  { id: 26, category: "Serious Offenses", rule: "Failure to attend general meeting", offense: "Failure to attend the general meeting during the designated time and place especially drivers without valid reason", penalties: ["Suspension 1 day", "Suspension 3 days", "Dismissal"], defaultDays: [1, 3, 0] },
  { id: 27, category: "Serious Offenses", rule: "Failure to observe personal cleanliness", offense: "Failure to observe personal cleanliness, uncouth clothings", penalties: ["Warning", "Suspension 3 days", "Suspension 1 week", "Dismissal"], defaultDays: [0, 3, 7, 0] },
  // Category V: Repeated Violations
  { id: 28, category: "Repeated Violations", rule: "Three warnings within 1 year", offense: "Three warning within a period of one (1) year last violation", penalties: ["Suspension 1 week"], defaultDays: [7] },
  { id: 29, category: "Repeated Violations", rule: "Three suspensions within 1 year", offense: "Three suspension within a period of one (1) year last violation", penalties: ["Dismissal"], defaultDays: [0] },
];

const Drivers = () => {
  const dispatch = useDispatch();
  const {
    drivers,
    total,
    page,
    pages,
    loading,
    error,
    selectedDriver,
    detailsLoading,
    verifyLoading,
    verifySuccess,
    rejectLoading,
    rejectSuccess,
    deleteLoading,
    deleteSuccess,
    suspendLoading,
    suspendSuccess,
    reinstateLoading,
    reinstateSuccess,
    stats,
    statsLoading,
  } = useSelector((state) => state.driver);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Rejection reason
  const [rejectReason, setRejectReason] = useState("");

  // Suspension form
  const [suspensionDays, setSuspensionDays] = useState(3);
  const [suspensionReason, setSuspensionReason] = useState("");
  const [selectedRule, setSelectedRule] = useState("");
  const [offenseNumber, setOffenseNumber] = useState(1);
  const [hoveredRule, setHoveredRule] = useState(null);
  const [isRuleDropdownOpen, setIsRuleDropdownOpen] = useState(false);
  const ruleDropdownRef = useRef(null);

  // Modals
  const { isOpen: isDetailsOpen, openModal: openDetailsModal, closeModal: closeDetailsModal } = useModal();
  const { isOpen: isRejectOpen, openModal: openRejectModal, closeModal: closeRejectModal } = useModal();
  const { isOpen: isDeleteOpen, openModal: openDeleteModal, closeModal: closeDeleteModal } = useModal();
  const { isOpen: isImageOpen, openModal: openImageModal, closeModal: closeImageModal } = useModal();
  const { isOpen: isSuspendOpen, openModal: openSuspendModal, closeModal: closeSuspendModal } = useModal();
  const { isOpen: isReinstateOpen, openModal: openReinstateModal, closeModal: closeReinstateModal } = useModal();

  // License statuses
  const licenseStatuses = {
    verified: { label: "Verified", color: "text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-900/20" },
    pending: { label: "Pending", color: "text-yellow-700 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/20" },
    expired: { label: "Expired", color: "text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-900/20" },
    none: { label: "No License", color: "text-gray-700 bg-gray-100 dark:text-gray-400 dark:bg-gray-800" },
  };

  // Fetch drivers on mount and filter change
  useEffect(() => {
    dispatch(fetchAllDrivers({
      page: currentPage,
      limit: 20,
      search: searchQuery,
      licenseStatus: statusFilter,
    }));
  }, [dispatch, currentPage, searchQuery, statusFilter]);

  // Fetch stats on mount
  useEffect(() => {
    dispatch(fetchLicenseStats());
  }, [dispatch]);

  // Handle success states
  useEffect(() => {
    if (verifySuccess) {
      dispatch(clearVerifyStatus());
      dispatch(fetchLicenseStats());
    }
  }, [verifySuccess, dispatch]);

  useEffect(() => {
    if (rejectSuccess) {
      closeRejectModal();
      setRejectReason("");
      dispatch(clearRejectStatus());
      dispatch(fetchLicenseStats());
    }
  }, [rejectSuccess, dispatch]);

  useEffect(() => {
    if (deleteSuccess) {
      closeDeleteModal();
      closeDetailsModal();
      dispatch(clearDeleteStatus());
      dispatch(fetchLicenseStats());
      dispatch(fetchAllDrivers({ page: currentPage, search: searchQuery, licenseStatus: statusFilter }));
    }
  }, [deleteSuccess, dispatch]);

  useEffect(() => {
    if (suspendSuccess) {
      closeSuspendModal();
      resetSuspensionForm();
      dispatch(clearSuspendStatus());
      dispatch(fetchAllDrivers({ page: currentPage, search: searchQuery, licenseStatus: statusFilter }));
    }
  }, [suspendSuccess, dispatch]);

  useEffect(() => {
    if (reinstateSuccess) {
      closeReinstateModal();
      dispatch(clearReinstateStatus());
      dispatch(fetchAllDrivers({ page: currentPage, search: searchQuery, licenseStatus: statusFilter }));
    }
  }, [reinstateSuccess, dispatch]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (ruleDropdownRef.current && !ruleDropdownRef.current.contains(event.target)) {
        setIsRuleDropdownOpen(false);
        setHoveredRule(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Auto-update suspension days based on selected rule and offense number
  useEffect(() => {
    if (selectedRule) {
      const rule = WEBTTODA_RULES.find(r => r.id === parseInt(selectedRule));
      if (rule && rule.defaultDays && rule.defaultDays.length > 0) {
        const offenseIdx = Math.min(offenseNumber - 1, rule.defaultDays.length - 1);
        const days = rule.defaultDays[offenseIdx];
        if (days === 0) {
          // Dismissal - set to a high number to indicate termination
          setSuspensionDays(0);
        } else {
          setSuspensionDays(days);
        }
      }
    }
  }, [selectedRule, offenseNumber]);

  const resetSuspensionForm = () => {
    setSuspensionDays(3);
    setSuspensionReason("");
    setSelectedRule("");
    setOffenseNumber(1);
    setHoveredRule(null);
    setIsRuleDropdownOpen(false);
  };

  const handleViewDriver = (driverId) => {
    dispatch(fetchDriverDetails(driverId));
    openDetailsModal();
  };

  const handleCloseDetails = () => {
    closeDetailsModal();
    dispatch(clearSelectedDriver());
  };

  const handleVerify = () => {
    if (selectedDriver?.license?._id) {
      dispatch(verifyDriverLicense(selectedDriver.license._id));
    }
  };

  const handleReject = () => {
    if (selectedDriver?.license?._id) {
      dispatch(rejectDriverLicense({ licenseId: selectedDriver.license._id, reason: rejectReason }));
    }
  };

  const handleDelete = () => {
    if (selectedDriver?.license?._id) {
      dispatch(deleteDriverLicense(selectedDriver.license._id));
    }
  };

  const handleSuspend = () => {
    if (selectedDriver?._id && (suspensionDays > 0 || suspensionDays === 0)) {
      const ruleObj = selectedRule 
        ? WEBTTODA_RULES.find(r => r.id === parseInt(selectedRule))
        : null;
      const ruleText = ruleObj?.rule || null;
      const penaltyIdx = Math.min(offenseNumber - 1, (ruleObj?.penalties?.length || 1) - 1);
      const penalty = ruleObj?.penalties?.[penaltyIdx] || null;
      
      // If dismissal (0 days), set a very long suspension period (e.g., 3650 days = 10 years)
      const effectiveDays = suspensionDays === 0 ? 3650 : suspensionDays;
      
      dispatch(suspendDriver({
        driverId: selectedDriver._id,
        days: effectiveDays,
        reason: suspensionReason || (suspensionDays === 0 
          ? `Dismissed from WEBTTODA - ${ruleText || 'Rule violation'}` 
          : `Suspended for ${suspensionDays} days`),
        ruleViolated: ruleText,
        offenseNumber: offenseNumber,
        penalty: penalty,
        isDismissal: suspensionDays === 0,
      }));
    }
  };

  const handleReinstate = () => {
    if (selectedDriver?._id) {
      dispatch(reinstateDriver(selectedDriver._id));
    }
  };

  const handleSearch = (e) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  };

  const handleStatusFilter = (status) => {
    setStatusFilter(status === statusFilter ? "" : status);
    setCurrentPage(1);
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
        title="Drivers Management | TricycleMOD Admin"
        description="Manage drivers and verify their licenses"
      />
      <PageBreadcrumb pageTitle="Drivers Management" />

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-900/20">
              <svg className="h-5 w-5 text-brand-600 dark:text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-semibold text-gray-800 dark:text-white">{statsLoading ? "..." : stats?.totalDrivers || 0}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Total Drivers</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
              <svg className="h-5 w-5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-semibold text-gray-800 dark:text-white">{statsLoading ? "..." : stats?.verified || 0}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Verified</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900/20">
              <svg className="h-5 w-5 text-yellow-600 dark:text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-semibold text-gray-800 dark:text-white">{statsLoading ? "..." : stats?.pending || 0}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Pending</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
              <svg className="h-5 w-5 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-semibold text-gray-800 dark:text-white">{statsLoading ? "..." : stats?.expired || 0}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Expired</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
              <svg className="h-5 w-5 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-2xl font-semibold text-gray-800 dark:text-white">{statsLoading ? "..." : stats?.noLicense || 0}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">No License</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        {/* Header with Search and Filters */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-800">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Drivers List</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {total} drivers found
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              {/* Search */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search drivers..."
                  value={searchQuery}
                  onChange={handleSearch}
                  className="h-10 w-full sm:w-64 rounded-lg border border-gray-300 bg-transparent pl-10 pr-4 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30"
                />
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>

              {/* Status Filter */}
              <div className="flex gap-2">
                {Object.entries(licenseStatuses).map(([key, { label, color }]) => (
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
        ) : drivers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500 dark:text-gray-400">
            <svg className="h-16 w-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="text-lg font-medium">No drivers found</p>
            <p className="text-sm">Try adjusting your search or filters</p>
          </div>
        ) : (
          <>
            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                      Driver
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                      Contact
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                      License Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                      Rating
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                      Joined
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider dark:text-gray-400">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                  {drivers.map((driver) => (
                    <tr key={driver._id} className="hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            {driver.image?.url ? (
                              <img className="h-10 w-10 rounded-full object-cover" src={driver.image.url} alt="" />
                            ) : (
                              <div className="h-10 w-10 rounded-full bg-brand-100 dark:bg-brand-900/20 flex items-center justify-center">
                                <span className="text-sm font-medium text-brand-700 dark:text-brand-400">
                                  {driver.firstname?.charAt(0) || "D"}
                                </span>
                              </div>
                            )}
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {driver.firstname} {driver.lastname}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              @{driver.username}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900 dark:text-white">{driver.email}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">{driver.phone || "No phone"}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                          <span className={`inline-flex w-fit px-2.5 py-0.5 rounded-full text-xs font-medium ${licenseStatuses[driver.licenseStatus]?.color}`}>
                            {licenseStatuses[driver.licenseStatus]?.label}
                          </span>
                          {driver.isSuspended && (
                            <span className="inline-flex w-fit px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400">
                              ⚠️ Suspended
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <svg className="h-4 w-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                          <span className="text-sm text-gray-900 dark:text-white">
                            {driver.rating?.toFixed(1) || "0.0"}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            ({driver.numReviews || 0})
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {formatDate(driver.createdAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleViewDriver(driver._id)}
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

      {/* Driver Details Modal */}
      <Modal isOpen={isDetailsOpen} onClose={handleCloseDetails} className="max-w-[800px] p-6 lg:p-8">
        {detailsLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-500"></div>
          </div>
        ) : selectedDriver ? (
          <div className="overflow-y-auto custom-scrollbar max-h-[85vh]">
            <div className="mb-6">
              <h3 className="text-xl font-semibold text-gray-800 dark:text-white">Driver Details</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">View and manage driver information</p>
            </div>

            {/* Driver Profile Section */}
            <div className="flex items-start gap-4 mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex-shrink-0">
                {selectedDriver.image?.url ? (
                  <img className="h-20 w-20 rounded-full object-cover" src={selectedDriver.image.url} alt="" />
                ) : (
                  <div className="h-20 w-20 rounded-full bg-brand-100 dark:bg-brand-900/20 flex items-center justify-center">
                    <span className="text-2xl font-medium text-brand-700 dark:text-brand-400">
                      {selectedDriver.firstname?.charAt(0) || "D"}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex-1">
                <h4 className="text-lg font-semibold text-gray-800 dark:text-white">
                  {selectedDriver.firstname} {selectedDriver.lastname}
                </h4>
                <p className="text-sm text-gray-500 dark:text-gray-400">@{selectedDriver.username}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${licenseStatuses[selectedDriver.licenseStatus]?.color}`}>
                    {licenseStatuses[selectedDriver.licenseStatus]?.label}
                  </span>
                  {selectedDriver.isVerified && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400">
                      <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Account Verified
                    </span>
                  )}
                  {selectedDriver.isSuspended && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400">
                      <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      Suspended
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <svg className="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <span className="text-lg font-semibold text-gray-800 dark:text-white">
                    {selectedDriver.rating?.toFixed(1) || "0.0"}
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">{selectedDriver.numReviews || 0} reviews</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{selectedDriver.tripCount || 0} trips</p>
              </div>
            </div>

            {/* Contact Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Email</p>
                <p className="text-sm font-medium text-gray-800 dark:text-white">{selectedDriver.email}</p>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Phone</p>
                <p className="text-sm font-medium text-gray-800 dark:text-white">{selectedDriver.phone || "Not provided"}</p>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Joined</p>
                <p className="text-sm font-medium text-gray-800 dark:text-white">{formatDate(selectedDriver.createdAt)}</p>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Last Login</p>
                <p className="text-sm font-medium text-gray-800 dark:text-white">{formatDate(selectedDriver.lastLogin)}</p>
              </div>
            </div>

            {/* Suspension Status */}
            {selectedDriver.isSuspended && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0">
                    <svg className="h-6 w-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-red-800 dark:text-red-300">Driver is Currently Suspended</h4>
                    <p className="mt-1 text-sm text-red-700 dark:text-red-400">
                      <strong>Reason:</strong> {selectedDriver.suspensionReason || "No reason provided"}
                    </p>
                    <p className="text-sm text-red-700 dark:text-red-400">
                      <strong>Suspended Until:</strong> {formatDate(selectedDriver.suspendedUntil)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* License Section */}
            <div className="mb-6">
              <h4 className="text-md font-semibold text-gray-800 dark:text-white mb-4">Driver&apos;s License</h4>
              
              {selectedDriver.license ? (
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  {/* License Image */}
                  {selectedDriver.license.imageUrl && (
                    <div 
                      className="relative h-48 bg-gray-100 dark:bg-gray-800 cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={openImageModal}
                    >
                      <img
                        src={selectedDriver.license.imageUrl}
                        alt="Driver's License"
                        className="w-full h-full object-contain"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition-opacity">
                        <span className="text-white text-sm font-medium">Click to enlarge</span>
                      </div>
                    </div>
                  )}
                  
                  {/* License Details */}
                  <div className="p-4 grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">License Number</p>
                      <p className="text-sm font-medium text-gray-800 dark:text-white">{selectedDriver.license.licenseNumber || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Name on License</p>
                      <p className="text-sm font-medium text-gray-800 dark:text-white">{selectedDriver.license.name || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Birthdate</p>
                      <p className="text-sm font-medium text-gray-800 dark:text-white">{formatDate(selectedDriver.license.birthdate)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Sex</p>
                      <p className="text-sm font-medium text-gray-800 dark:text-white">{selectedDriver.license.sex || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Issue Date</p>
                      <p className="text-sm font-medium text-gray-800 dark:text-white">{formatDate(selectedDriver.license.issuedDate)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Expiry Date</p>
                      <p className={`text-sm font-medium ${
                        selectedDriver.license.expiryDate && new Date(selectedDriver.license.expiryDate) < new Date()
                          ? "text-red-600 dark:text-red-400"
                          : "text-gray-800 dark:text-white"
                      }`}>
                        {formatDate(selectedDriver.license.expiryDate)}
                        {selectedDriver.license.expiryDate && new Date(selectedDriver.license.expiryDate) < new Date() && " (EXPIRED)"}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Address</p>
                      <p className="text-sm font-medium text-gray-800 dark:text-white">{selectedDriver.license.address || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Blood Type</p>
                      <p className="text-sm font-medium text-gray-800 dark:text-white">{selectedDriver.license.bloodType || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Restrictions</p>
                      <p className="text-sm font-medium text-gray-800 dark:text-white">{selectedDriver.license.restrictions || "None"}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                  <svg className="h-12 w-12 mx-auto text-gray-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                  </svg>
                  <p className="text-sm text-gray-500 dark:text-gray-400">No license uploaded yet</p>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              {/* Suspension Actions */}
              {selectedDriver.isSuspended ? (
                <button
                  onClick={openReinstateModal}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-green-700 bg-green-100 rounded-lg hover:bg-green-200 dark:text-green-400 dark:bg-green-900/20 dark:hover:bg-green-900/40"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Reinstate Driver
                </button>
              ) : (
                <button
                  onClick={openSuspendModal}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-orange-700 bg-orange-100 rounded-lg hover:bg-orange-200 dark:text-orange-400 dark:bg-orange-900/20 dark:hover:bg-orange-900/40"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                  Suspend Driver
                </button>
              )}

              {selectedDriver.license && (
                <>
                  {selectedDriver.licenseStatus === "pending" && (
                    <button
                      onClick={handleVerify}
                      disabled={verifyLoading}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {verifyLoading ? (
                        <>
                          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          Verifying...
                        </>
                      ) : (
                        <>
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Approve License
                        </>
                      )}
                    </button>
                  )}

                  {(selectedDriver.licenseStatus === "pending" || selectedDriver.licenseStatus === "verified") && (
                    <button
                      onClick={openRejectModal}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-yellow-700 bg-yellow-100 rounded-lg hover:bg-yellow-200 dark:text-yellow-400 dark:bg-yellow-900/20 dark:hover:bg-yellow-900/40"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      {selectedDriver.licenseStatus === "verified" ? "Revoke Verification" : "Reject"}
                    </button>
                  )}

                  <button
                    onClick={openDeleteModal}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-red-700 bg-red-100 rounded-lg hover:bg-red-200 dark:text-red-400 dark:bg-red-900/20 dark:hover:bg-red-900/40"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete License
                  </button>
                </>
              )}

              <button
                onClick={handleCloseDetails}
                className="ml-auto px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 dark:text-gray-400 dark:bg-gray-800 dark:hover:bg-gray-700"
              >
                Close
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Reject Modal */}
      <Modal isOpen={isRejectOpen} onClose={closeRejectModal} className="max-w-[400px] p-6">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900/20">
            <svg className="h-6 w-6 text-yellow-600 dark:text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h3 className="mt-4 text-lg font-semibold text-gray-800 dark:text-white">
            Reject License
          </h3>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            This will unverify the driver&apos;s license. Optionally provide a reason.
          </p>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Reason for rejection (optional)"
            rows={3}
            className="mt-4 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 resize-none"
          />
          <div className="mt-6 flex gap-3 justify-center">
            <button
              onClick={closeRejectModal}
              className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 dark:text-gray-400 dark:bg-gray-800 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              onClick={handleReject}
              disabled={rejectLoading}
              className="px-4 py-2.5 text-sm font-medium text-white bg-yellow-600 rounded-lg hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {rejectLoading ? "Rejecting..." : "Reject License"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal isOpen={isDeleteOpen} onClose={closeDeleteModal} className="max-w-[400px] p-6">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
            <svg className="h-6 w-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
          <h3 className="mt-4 text-lg font-semibold text-gray-800 dark:text-white">
            Delete License
          </h3>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Are you sure you want to delete this driver&apos;s license? This action cannot be undone.
          </p>
          <div className="mt-6 flex gap-3 justify-center">
            <button
              onClick={closeDeleteModal}
              className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 dark:text-gray-400 dark:bg-gray-800 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={deleteLoading}
              className="px-4 py-2.5 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {deleteLoading ? "Deleting..." : "Delete"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Image Fullscreen Modal */}
      <Modal isOpen={isImageOpen} onClose={closeImageModal} className="max-w-[90vw] max-h-[90vh] p-2">
        {selectedDriver?.license?.imageUrl && (
          <img
            src={selectedDriver.license.imageUrl}
            alt="Driver's License"
            className="w-full h-full object-contain max-h-[85vh]"
          />
        )}
      </Modal>

      {/* Suspend Driver Modal */}
      <Modal isOpen={isSuspendOpen} onClose={closeSuspendModal} className="max-w-[500px] p-6">
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/20">
              <svg className="h-6 w-6 text-orange-600 dark:text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Suspend Driver</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {selectedDriver?.firstname} {selectedDriver?.lastname}
              </p>
            </div>
          </div>

          {/* Suspension Duration */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Suspension Duration
            </label>
            <div className="grid grid-cols-5 gap-2 mb-2">
              {SUSPENSION_PRESETS.map((preset) => (
                <button
                  key={preset.days}
                  onClick={() => setSuspensionDays(preset.days)}
                  className={`px-3 py-2 text-xs font-medium rounded-lg border transition-all ${
                    suspensionDays === preset.days
                      ? "bg-orange-100 border-orange-500 text-orange-700 dark:bg-orange-900/30 dark:border-orange-500 dark:text-orange-400"
                      : "border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={suspensionDays}
                onChange={(e) => setSuspensionDays(Math.max(0, parseInt(e.target.value) || 0))}
                min="0"
                className="w-20 h-10 rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
              />
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {suspensionDays === 0 ? "(Dismissal)" : "days"}
              </span>
            </div>
          </div>

          {/* Rule Violated (WEBTTODA Reference) - Custom Dropdown with Tooltips */}
          <div className="mb-4" ref={ruleDropdownRef}>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Rule Violated (WEBTTODA Rules)
            </label>
            <div className="relative">
              {/* Dropdown Trigger */}
              <button
                type="button"
                onClick={() => setIsRuleDropdownOpen(!isRuleDropdownOpen)}
                className="w-full h-10 rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-left text-gray-800 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 flex items-center justify-between"
              >
                <span className={selectedRule ? "" : "text-gray-400 dark:text-gray-500"}>
                  {selectedRule 
                    ? `#${selectedRule} - ${WEBTTODA_RULES.find(r => r.id === parseInt(selectedRule))?.rule}` 
                    : "Select a rule (optional)"}
                </span>
                <svg className={`w-4 h-4 transition-transform ${isRuleDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown Menu */}
              {isRuleDropdownOpen && (
                <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {/* Clear Selection Option */}
                  <div
                    onClick={() => {
                      setSelectedRule("");
                      setIsRuleDropdownOpen(false);
                      setHoveredRule(null);
                    }}
                    className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-100 dark:border-gray-700"
                  >
                    Clear selection
                  </div>
                  
                  {/* Group by Category */}
                  {["Work & Drive Efficiency", "Act of Dishonesty", "Act Against Public Policy", "Serious Offenses", "Repeated Violations"].map((category) => (
                    <div key={category}>
                      <div className="px-3 py-1.5 text-xs font-semibold text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-900/50 sticky top-0">
                        {category}
                      </div>
                      {WEBTTODA_RULES.filter(r => r.category === category).map((rule) => (
                        <div
                          key={rule.id}
                          onClick={() => {
                            setSelectedRule(rule.id.toString());
                            setIsRuleDropdownOpen(false);
                            setHoveredRule(null);
                          }}
                          onMouseEnter={() => setHoveredRule(rule)}
                          onMouseLeave={() => setHoveredRule(null)}
                          className={`relative px-3 py-2 text-sm cursor-pointer transition-colors ${
                            selectedRule === rule.id.toString()
                              ? "bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                              : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="truncate pr-2">#{rule.id} - {rule.rule}</span>
                            <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>

                          {/* Tooltip on hover */}
                          {hoveredRule?.id === rule.id && (
                            <div className="absolute left-full top-0 ml-2 w-72 p-3 bg-gray-900 dark:bg-gray-700 text-white rounded-lg shadow-xl z-[60] pointer-events-none">
                              <div className="text-xs font-semibold text-orange-400 mb-1">Rule #{rule.id}</div>
                              <div className="text-sm font-medium mb-2">{rule.offense}</div>
                              <div className="text-xs text-gray-300 mb-2">Category: {rule.category}</div>
                              <div className="border-t border-gray-700 dark:border-gray-600 pt-2 mt-2">
                                <div className="text-xs font-semibold text-gray-400 mb-1">Penalties:</div>
                                {rule.penalties.map((penalty, idx) => (
                                  <div key={idx} className="text-xs text-gray-300 flex items-center gap-1">
                                    <span className="text-orange-400">{idx + 1}{idx === 0 ? "st" : idx === 1 ? "nd" : idx === 2 ? "rd" : "th"}:</span>
                                    <span className={penalty === "Dismissal" ? "text-red-400 font-medium" : ""}>{penalty}</span>
                                  </div>
                                ))}
                              </div>
                              {/* Arrow pointing left */}
                              <div className="absolute left-0 top-4 -translate-x-1 w-2 h-2 bg-gray-900 dark:bg-gray-700 rotate-45"></div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* Selected Rule Info */}
            {selectedRule && (
              <div className="mt-2 p-2 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                <div className="text-xs text-orange-700 dark:text-orange-400">
                  <strong>Selected:</strong> {WEBTTODA_RULES.find(r => r.id === parseInt(selectedRule))?.offense}
                </div>
                <div className="text-xs text-orange-600 dark:text-orange-500 mt-1">
                  <strong>Penalty ({offenseNumber === 1 ? "1st" : offenseNumber === 2 ? "2nd" : offenseNumber === 3 ? "3rd" : "4th"} offense):</strong>{" "}
                  {(() => {
                    const rule = WEBTTODA_RULES.find(r => r.id === parseInt(selectedRule));
                    if (rule) {
                      const idx = Math.min(offenseNumber - 1, rule.penalties.length - 1);
                      return rule.penalties[idx];
                    }
                    return "N/A";
                  })()}
                </div>
              </div>
            )}
          </div>

          {/* Offense Number */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Offense Number
              {selectedRule && (
                <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                  (Max: {WEBTTODA_RULES.find(r => r.id === parseInt(selectedRule))?.penalties?.length || 4} offenses)
                </span>
              )}
            </label>
            <div className="flex gap-2">
              {[1, 2, 3, 4].map((num) => {
                const selectedRuleObj = selectedRule ? WEBTTODA_RULES.find(r => r.id === parseInt(selectedRule)) : null;
                const maxOffenses = selectedRuleObj?.penalties?.length || 4;
                const isDisabled = num > maxOffenses;
                const penaltyText = selectedRuleObj?.penalties?.[num - 1] || "";
                
                return (
                  <button
                    key={num}
                    onClick={() => !isDisabled && setOffenseNumber(num)}
                    disabled={isDisabled}
                    title={isDisabled ? "Not applicable for this rule" : penaltyText}
                    className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg border transition-all ${
                      isDisabled
                        ? "border-gray-200 text-gray-300 bg-gray-50 cursor-not-allowed dark:border-gray-700 dark:text-gray-600 dark:bg-gray-800/50"
                        : offenseNumber === num
                          ? penaltyText?.includes("Dismissal")
                            ? "bg-red-100 border-red-500 text-red-700 dark:bg-red-900/30 dark:border-red-500 dark:text-red-400"
                            : "bg-orange-100 border-orange-500 text-orange-700 dark:bg-orange-900/30 dark:border-orange-500 dark:text-orange-400"
                          : "border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
                    }`}
                  >
                    <span>{num === 1 ? "1st" : num === 2 ? "2nd" : num === 3 ? "3rd" : "4th"}</span>
                    {selectedRuleObj && !isDisabled && (
                      <span className={`block text-[10px] mt-0.5 ${penaltyText?.includes("Dismissal") ? "text-red-500 dark:text-red-400" : "text-gray-500 dark:text-gray-400"}`}>
                        {penaltyText?.includes("Dismissal") ? "⚠ Dismissal" : 
                         penaltyText?.includes("1 day") ? "1 day" :
                         penaltyText?.includes("3 days") ? "3 days" :
                         penaltyText?.includes("1 week") ? "1 week" :
                         penaltyText?.includes("2 weeks") ? "2 weeks" :
                         penaltyText?.includes("1 month") ? "1 month" :
                         penaltyText?.includes("Warning") ? "Warning" : ""}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Reason */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Reason for Suspension
            </label>
            <textarea
              value={suspensionReason}
              onChange={(e) => setSuspensionReason(e.target.value)}
              placeholder="Describe the reason for this suspension..."
              rows={3}
              className="w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => {
                closeSuspendModal();
                resetSuspensionForm();
              }}
              className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 dark:text-gray-400 dark:bg-gray-800 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              onClick={handleSuspend}
              disabled={suspendLoading || !suspensionReason.trim()}
              className={`px-4 py-2.5 text-sm font-medium text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed ${
                suspensionDays === 0 
                  ? "bg-red-600 hover:bg-red-700" 
                  : "bg-orange-600 hover:bg-orange-700"
              }`}
            >
              {suspendLoading 
                ? "Processing..." 
                : suspensionDays === 0 
                  ? "Dismiss Driver" 
                  : `Suspend for ${suspensionDays} Day${suspensionDays > 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      </Modal>

      {/* Reinstate Driver Modal */}
      <Modal isOpen={isReinstateOpen} onClose={closeReinstateModal} className="max-w-[400px] p-6">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
            <svg className="h-6 w-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="mt-4 text-lg font-semibold text-gray-800 dark:text-white">
            Reinstate Driver
          </h3>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Are you sure you want to reinstate{" "}
            <strong>{selectedDriver?.firstname} {selectedDriver?.lastname}</strong>?
          </p>
          {selectedDriver?.suspensionReason && (
            <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
              Original reason: {selectedDriver.suspensionReason}
            </p>
          )}
          <div className="mt-6 flex gap-3 justify-center">
            <button
              onClick={closeReinstateModal}
              className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 dark:text-gray-400 dark:bg-gray-800 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              onClick={handleReinstate}
              disabled={reinstateLoading}
              className="px-4 py-2.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {reinstateLoading ? "Processing..." : "Reinstate"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default Drivers;
