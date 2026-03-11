import { useEffect, useState, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import PageMeta from '../components/common/PageMeta';
import PageBreadCrumb from '../components/common/PageBreadCrumb';
import { fetchUsersWithActivity, fetchUserDetails, changeUserRole } from '../redux/actions/userListAction';
import { clearSelectedUser, clearRoleChangeStatus } from '../redux/reducers/userListReducer';

// Auto-refresh interval (30 seconds)
const AUTO_REFRESH_INTERVAL = 30 * 1000;

// Icons
const SearchIcon = () => (
  <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const OnlineIcon = () => (
  <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></span>
);

const OfflineIcon = () => (
  <span className="inline-block w-2.5 h-2.5 rounded-full bg-gray-400"></span>
);

const SortIcon = ({ active, direction }) => (
  <svg className={`w-4 h-4 ml-1 ${active ? 'text-blue-500' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    {direction === 'asc' ? (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
    ) : (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    )}
  </svg>
);

const CloseIcon = () => (
  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const WarningIcon = () => (
  <svg className="w-6 h-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);

const StarIcon = ({ filled }) => (
  <svg className={`w-4 h-4 ${filled ? 'text-yellow-400 fill-current' : 'text-gray-300'}`} viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
  </svg>
);

export default function Users() {
  const dispatch = useDispatch();
  const { users, pagination, counts, loading, selectedUser, detailsLoading, roleChangeLoading, roleChangeSuccess, roleChangeError } = useSelector(
    (state) => state.userList
  );

  const [filters, setFilters] = useState({
    role: 'all',
    status: 'all',
    search: '',
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });
  const [searchInput, setSearchInput] = useState('');
  const [showUserModal, setShowUserModal] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const autoRefreshRef = useRef(null);

  // Role change modal state
  const [showRoleChangeModal, setShowRoleChangeModal] = useState(false);
  const [selectedNewRole, setSelectedNewRole] = useState('');
  const [confirmationInput, setConfirmationInput] = useState('');
  const [roleChangeMessage, setRoleChangeMessage] = useState({ type: '', text: '' });

  const fetchUsers = useCallback(() => {
    dispatch(
      fetchUsersWithActivity({
        page: pagination.currentPage,
        limit: pagination.limit,
        ...filters,
      })
    );
  }, [dispatch, pagination.currentPage, pagination.limit, filters]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Auto-refresh for live status updates
  useEffect(() => {
    if (autoRefresh) {
      autoRefreshRef.current = setInterval(() => {
        fetchUsers();
      }, AUTO_REFRESH_INTERVAL);
    }
    return () => {
      if (autoRefreshRef.current) {
        clearInterval(autoRefreshRef.current);
      }
    };
  }, [autoRefresh, fetchUsers]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== filters.search) {
        setFilters((prev) => ({ ...prev, search: searchInput }));
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchInput, filters.search]);

  // Handle role change success/error
  useEffect(() => {
    if (roleChangeSuccess) {
      setRoleChangeMessage({ type: 'success', text: 'Role changed successfully!' });
      setShowRoleChangeModal(false);
      setConfirmationInput('');
      setSelectedNewRole('');
      fetchUsers();
      dispatch(clearRoleChangeStatus());
    }
    if (roleChangeError) {
      setRoleChangeMessage({ type: 'error', text: roleChangeError });
      dispatch(clearRoleChangeStatus());
    }
  }, [roleChangeSuccess, roleChangeError, dispatch, fetchUsers]);

  // Clear message after 3 seconds
  useEffect(() => {
    if (roleChangeMessage.text) {
      const timer = setTimeout(() => {
        setRoleChangeMessage({ type: '', text: '' });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [roleChangeMessage]);

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleSort = (sortBy) => {
    setFilters((prev) => ({
      ...prev,
      sortBy,
      sortOrder: prev.sortBy === sortBy && prev.sortOrder === 'desc' ? 'asc' : 'desc',
    }));
  };

  const handlePageChange = (newPage) => {
    dispatch(
      fetchUsersWithActivity({
        page: newPage,
        limit: pagination.limit,
        ...filters,
      })
    );
  };

  const handleViewUser = (userId) => {
    dispatch(fetchUserDetails(userId));
    setShowUserModal(true);
  };

  const closeUserModal = () => {
    setShowUserModal(false);
    setShowRoleChangeModal(false);
    setConfirmationInput('');
    setSelectedNewRole('');
    dispatch(clearSelectedUser());
  };

  const handleOpenRoleChangeModal = () => {
    if (selectedUser && selectedUser.role !== 'admin') {
      setSelectedNewRole(selectedUser.role === 'driver' ? 'operator' : 'driver');
      setShowRoleChangeModal(true);
    }
  };

  const handleRoleChange = () => {
    if (!selectedUser || !selectedNewRole || !confirmationInput) return;

    dispatch(changeUserRole({
      userId: selectedUser._id,
      newRole: selectedNewRole,
      confirmationCode: confirmationInput,
    }));
  };

  const formatDate = (date) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatTimeAgo = (date) => {
    if (!date) return 'Never';
    const now = new Date();
    const past = new Date(date);
    const diffMs = now - past;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(date);
  };

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'driver':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'operator':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
      case 'driOps':
        return 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400';
      case 'guest':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'admin':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const renderStarRating = (rating) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(<StarIcon key={i} filled={i <= rating} />);
    }
    return <div className="flex gap-0.5">{stars}</div>;
  };

  return (
    <>
      <PageMeta title="Users | TricycleMOD Admin" description="Manage all users" />
      <PageBreadCrumb pageTitle="Users" />

      {/* Role Change Message */}
      {roleChangeMessage.text && (
        <div className={`mb-4 p-4 rounded-lg ${roleChangeMessage.type === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'}`}>
          {roleChangeMessage.text}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Users</p>
              <p className="text-2xl font-bold text-gray-800 dark:text-white">{counts.total}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Online</p>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">{counts.online}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
              <OnlineIcon />
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Offline</p>
              <p className="text-2xl font-bold text-gray-600 dark:text-gray-400">{counts.offline}</p>
            </div>
            <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
              <OfflineIcon />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <SearchIcon />
            </div>
            <input
              type="text"
              placeholder="Search by name, email, or phone..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Role Filter */}
          <select
            value={filters.role}
            onChange={(e) => handleFilterChange('role', e.target.value)}
            className="px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Roles</option>
            <option value="guest">Guests</option>
            <option value="driver">Drivers</option>
            <option value="operator">Operators</option>
            <option value="driOps">DriOps</option>
          </select>

          {/* Status Filter */}
          <select
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            className="px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Status</option>
            <option value="online">Online</option>
            <option value="offline">Offline</option>
          </select>

          {/* Refresh */}
          <button
            onClick={fetchUsers}
            className="px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <svg className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>

          {/* Auto-refresh toggle */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-4 py-2.5 rounded-lg transition-colors flex items-center gap-2 ${
              autoRefresh 
                ? 'bg-green-600 text-white hover:bg-green-700' 
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
            title={autoRefresh ? 'Auto-refresh enabled (every 30s)' : 'Auto-refresh disabled'}
          >
            <span className={`w-2 h-2 rounded-full ${autoRefresh ? 'bg-white animate-pulse' : 'bg-gray-400'}`}></span>
            Live
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900/50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  <button
                    onClick={() => handleSort('name')}
                    className="flex items-center hover:text-gray-700 dark:hover:text-gray-200"
                  >
                    User
                    <SortIcon active={filters.sortBy === 'name'} direction={filters.sortOrder} />
                  </button>
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  <button
                    onClick={() => handleSort('role')}
                    className="flex items-center hover:text-gray-700 dark:hover:text-gray-200"
                  >
                    Role
                    <SortIcon active={filters.sortBy === 'role'} direction={filters.sortOrder} />
                  </button>
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  <button
                    onClick={() => handleSort('isOnline')}
                    className="flex items-center hover:text-gray-700 dark:hover:text-gray-200"
                  >
                    Status
                    <SortIcon active={filters.sortBy === 'isOnline'} direction={filters.sortOrder} />
                  </button>
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  <button
                    onClick={() => handleSort('lastSeen')}
                    className="flex items-center hover:text-gray-700 dark:hover:text-gray-200"
                  >
                    Last Seen
                    <SortIcon active={filters.sortBy === 'lastSeen'} direction={filters.sortOrder} />
                  </button>
                </th>
                <th className="px-6 py-4 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Details
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {loading ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                    </div>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                    No users found
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr
                    key={user._id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          {user.profileImage ? (
                            <img
                              src={user.profileImage}
                              alt={`${user.firstName} ${user.lastName}`}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                              <span className="text-gray-600 dark:text-gray-300 font-medium">
                                {user.firstName?.[0]}{user.lastName?.[0]}
                              </span>
                            </div>
                          )}
                          <span
                            className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-gray-800 ${
                              user.isOnline ? 'bg-green-500' : 'bg-gray-400'
                            }`}
                          ></span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {user.firstName} {user.lastName}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium capitalize ${getRoleBadgeColor(
                          user.role
                        )}`}
                      >
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {user.isOnline ? <OnlineIcon /> : <OfflineIcon />}
                        <span
                          className={`text-sm ${
                            user.isOnline
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-gray-500 dark:text-gray-400'
                          }`}
                        >
                          {user.isOnline ? 'Online' : 'Offline'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {formatTimeAgo(user.lastSeen)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => handleViewUser(user._id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 font-medium text-sm transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Showing {(pagination.currentPage - 1) * pagination.limit + 1} to{' '}
              {Math.min(pagination.currentPage * pagination.limit, pagination.totalUsers)} of{' '}
              {pagination.totalUsers} users
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => handlePageChange(pagination.currentPage - 1)}
                disabled={pagination.currentPage === 1}
                className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Previous
              </button>
              {[...Array(Math.min(5, pagination.totalPages))].map((_, i) => {
                let pageNum;
                if (pagination.totalPages <= 5) {
                  pageNum = i + 1;
                } else if (pagination.currentPage <= 3) {
                  pageNum = i + 1;
                } else if (pagination.currentPage >= pagination.totalPages - 2) {
                  pageNum = pagination.totalPages - 4 + i;
                } else {
                  pageNum = pagination.currentPage - 2 + i;
                }

                return (
                  <button
                    key={pageNum}
                    onClick={() => handlePageChange(pageNum)}
                    className={`px-3 py-1.5 rounded-lg border ${
                      pagination.currentPage === pageNum
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                onClick={() => handlePageChange(pagination.currentPage + 1)}
                disabled={pagination.currentPage === pagination.totalPages}
                className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* User Details Modal */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            <div
              className="fixed inset-0 bg-black/50 transition-opacity"
              onClick={closeUserModal}
            ></div>
            <div className="relative bg-white dark:bg-gray-800 rounded-2xl max-w-2xl w-full mx-auto shadow-xl transform transition-all max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="sticky top-0 bg-white dark:bg-gray-800 flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 z-10">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  User Details
                </h3>
                <button
                  onClick={closeUserModal}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <CloseIcon />
                </button>
              </div>

              {/* Modal Body */}
              <div className="px-6 py-6">
                {detailsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                  </div>
                ) : selectedUser ? (
                  <div className="space-y-6">
                    {/* Profile Header */}
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        {selectedUser.profileImage || selectedUser.image?.url ? (
                          <img
                            src={selectedUser.profileImage || selectedUser.image?.url}
                            alt={`${selectedUser.firstname || selectedUser.firstName} ${selectedUser.lastname || selectedUser.lastName}`}
                            className="w-20 h-20 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-20 h-20 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                            <span className="text-2xl text-gray-600 dark:text-gray-300 font-medium">
                              {(selectedUser.firstname || selectedUser.firstName)?.[0]}{(selectedUser.lastname || selectedUser.lastName)?.[0]}
                            </span>
                          </div>
                        )}
                        <span
                          className={`absolute bottom-1 right-1 w-4 h-4 rounded-full border-2 border-white dark:border-gray-800 ${
                            selectedUser.isOnline ? 'bg-green-500' : 'bg-gray-400'
                          }`}
                        ></span>
                      </div>
                      <div className="flex-1">
                        <h4 className="text-xl font-semibold text-gray-900 dark:text-white">
                          {selectedUser.firstname || selectedUser.firstName} {selectedUser.lastname || selectedUser.lastName}
                        </h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400">@{selectedUser.username}</p>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <span
                            className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium capitalize ${getRoleBadgeColor(
                              selectedUser.role
                            )}`}
                          >
                            {selectedUser.role}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                              selectedUser.isOnline
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                            }`}
                          >
                            {selectedUser.isOnline ? <OnlineIcon /> : <OfflineIcon />}
                            {selectedUser.isOnline ? 'Online' : 'Offline'}
                          </span>
                          {selectedUser.isVerified && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                              Verified
                            </span>
                          )}
                        </div>
                      </div>
                      {/* Change Role Button - only for non-admin users */}
                      {selectedUser.role !== 'admin' && (
                        <button
                          onClick={handleOpenRoleChangeModal}
                          className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-medium text-sm transition-colors flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          Change Role
                        </button>
                      )}
                    </div>

                    {/* Contact Information */}
                    <div>
                      <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        Contact Information
                      </h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Email</p>
                          <p className="text-sm font-medium text-gray-900 dark:text-white break-all">
                            {selectedUser.email || 'N/A'}
                          </p>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Phone</p>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {selectedUser.phone || selectedUser.phoneNumber || 'N/A'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Address */}
                    <div>
                      <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Address
                      </h5>
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {selectedUser.address
                            ? typeof selectedUser.address === 'object'
                              ? [
                                  selectedUser.address.street,
                                  selectedUser.address.city,
                                  selectedUser.address.postalCode,
                                  selectedUser.address.country,
                                ]
                                  .filter(Boolean)
                                  .join(', ') || 'N/A'
                              : selectedUser.address
                            : 'N/A'}
                        </p>
                      </div>
                    </div>

                    {/* Activity & Statistics */}
                    <div>
                      <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        Activity & Statistics
                      </h5>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Trip Count</p>
                          <p className="text-lg font-bold text-gray-900 dark:text-white">
                            {selectedUser.tripCount || 0}
                          </p>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Rating</p>
                          <div className="flex items-center gap-2">
                            <span className="text-lg font-bold text-gray-900 dark:text-white">
                              {(selectedUser.rating || 0).toFixed(1)}
                            </span>
                            {renderStarRating(Math.round(selectedUser.rating || 0))}
                          </div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            ({selectedUser.numReviews || 0} reviews)
                          </p>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Loyalty</p>
                          <p className="text-lg font-bold text-gray-900 dark:text-white">
                            {selectedUser.loyaltyMonths || 0} <span className="text-sm font-normal">months</span>
                          </p>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Lost & Found Posted</p>
                          <p className="text-lg font-bold text-gray-900 dark:text-white">
                            {selectedUser.lostFoundPosted || 0}
                          </p>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Lost & Found Claimed</p>
                          <p className="text-lg font-bold text-gray-900 dark:text-white">
                            {selectedUser.lostFoundClaimed || 0}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Dates */}
                    <div>
                      <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        Account Dates
                      </h5>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Joined</p>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {formatDate(selectedUser.createdAt)}
                          </p>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Last Login</p>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {formatDate(selectedUser.lastLogin)}
                          </p>
                        </div>
                        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Last Seen</p>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {formatDate(selectedUser.lastSeen)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Device Info */}
                    {selectedUser.deviceInfo && (
                      <div>
                        <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                          Device Information
                        </h5>
                        <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                          <p className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                            Platform: {selectedUser.deviceInfo.platform || 'Unknown'}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* User ID */}
                    <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        User ID: {selectedUser._id}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                    User not found
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Role Change Confirmation Modal */}
      {showRoleChangeModal && selectedUser && (
        <div className="fixed inset-0 z-[60] overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
            <div
              className="fixed inset-0 bg-black/60 transition-opacity"
              onClick={() => setShowRoleChangeModal(false)}
            ></div>
            <div className="relative bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full mx-auto shadow-xl transform transition-all">
              {/* Modal Header */}
              <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <WarningIcon />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Change User Role
                </h3>
              </div>

              {/* Modal Body */}
              <div className="px-6 py-6">
                <div className="mb-6">
                  <p className="text-gray-700 dark:text-gray-300 mb-4">
                    You are about to change the role of <span className="font-semibold">{selectedUser.firstname || selectedUser.firstName} {selectedUser.lastname || selectedUser.lastName}</span> from{' '}
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium capitalize ${getRoleBadgeColor(selectedUser.role)}`}>
                      {selectedUser.role}
                    </span>{' '}
                    to:
                  </p>

                  {/* Role Selection */}
                  <div className="flex gap-3 mb-6">
                    {['guest', 'driver', 'operator', 'driOps'].map((role) => (
                      <button
                        key={role}
                        onClick={() => setSelectedNewRole(role)}
                        disabled={role === selectedUser.role}
                        className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all capitalize font-medium ${
                          selectedNewRole === role
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                            : role === selectedUser.role
                            ? 'border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {role}
                      </button>
                    ))}
                  </div>

                  {/* Warning Box */}
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-6">
                    <p className="text-sm text-amber-800 dark:text-amber-300 font-medium mb-2">
                      ⚠️ Warning: This action requires confirmation
                    </p>
                    <p className="text-sm text-amber-700 dark:text-amber-400">
                      To confirm this role change, please type the following confirmation code:
                    </p>
                    <code className="block mt-2 p-2 bg-amber-100 dark:bg-amber-900/40 rounded text-amber-900 dark:text-amber-200 font-mono text-sm break-all">
                      webttrac_{selectedUser.email}
                    </code>
                  </div>

                  {/* Confirmation Input */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Confirmation Code
                    </label>
                    <input
                      type="text"
                      value={confirmationInput}
                      onChange={(e) => setConfirmationInput(e.target.value)}
                      placeholder="Enter confirmation code..."
                      className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                    />
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowRoleChangeModal(false);
                      setConfirmationInput('');
                      setSelectedNewRole('');
                    }}
                    className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRoleChange}
                    disabled={!confirmationInput || confirmationInput !== `webttrac_${selectedUser.email}` || !selectedNewRole || selectedNewRole === selectedUser.role || roleChangeLoading}
                    className="flex-1 px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {roleChangeLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                        Changing...
                      </>
                    ) : (
                      'Confirm Change'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
