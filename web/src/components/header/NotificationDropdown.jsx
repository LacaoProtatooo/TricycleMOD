import { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Dropdown } from "../ui/dropdown/Dropdown";
import { DropdownItem } from "../ui/dropdown/DropdownItem";
import { Link } from "react-router-dom";
import {
  fetchAdminNotifications,
  fetchNotificationCounts,
  markNotificationRead,
  markAllNotificationsRead,
} from "../../redux/actions/adminNotificationAction";

export default function NotificationDropdown() {
  const dispatch = useDispatch();
  const { notifications, counts, loading, markingRead } = useSelector(
    (state) => state.adminNotification
  );

  const [isOpen, setIsOpen] = useState(false);

  // Fetch notification counts on mount
  useEffect(() => {
    dispatch(fetchNotificationCounts());
    
    // Refresh counts every 5 minutes
    const interval = setInterval(() => {
      dispatch(fetchNotificationCounts());
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [dispatch]);

  // Fetch notifications when dropdown opens
  useEffect(() => {
    if (isOpen) {
      dispatch(fetchAdminNotifications({ limit: 10 }));
    }
  }, [dispatch, isOpen]);

  function toggleDropdown() {
    setIsOpen(!isOpen);
  }

  function closeDropdown() {
    setIsOpen(false);
  }

  const handleClick = () => {
    toggleDropdown();
  };

  const handleMarkAsRead = (e, notificationId) => {
    e.preventDefault();
    e.stopPropagation();
    dispatch(markNotificationRead(notificationId));
  };

  const handleMarkAllAsRead = () => {
    dispatch(markAllNotificationsRead());
  };

  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes} min ago`;
    if (hours < 24) return `${hours} hr ago`;
    return `${days} day${days > 1 ? "s" : ""} ago`;
  };

  const formatExpiryTime = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const now = new Date();
    const diff = date - now;
    const hours = Math.floor(diff / 3600000);

    if (hours <= 0) return "Expired";
    if (hours < 24) return `${hours} hr left`;
    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? "s" : ""} left`;
  };

  const notifying = counts?.total > 0;
  return (
    <div className="relative">
      <button
        className="relative flex items-center justify-center text-gray-500 transition-colors bg-white border border-gray-200 rounded-full dropdown-toggle hover:text-gray-700 h-11 w-11 hover:bg-gray-100 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
        onClick={handleClick}
      >
        {notifying && (
          <span className="absolute -right-0.5 -top-0.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {counts.total > 99 ? "99+" : counts.total}
          </span>
        )}
        <svg
          className="fill-current"
          width="20"
          height="20"
          viewBox="0 0 20 20"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M10.75 2.29248C10.75 1.87827 10.4143 1.54248 10 1.54248C9.58583 1.54248 9.25004 1.87827 9.25004 2.29248V2.83613C6.08266 3.20733 3.62504 5.9004 3.62504 9.16748V14.4591H3.33337C2.91916 14.4591 2.58337 14.7949 2.58337 15.2091C2.58337 15.6234 2.91916 15.9591 3.33337 15.9591H4.37504H15.625H16.6667C17.0809 15.9591 17.4167 15.6234 17.4167 15.2091C17.4167 14.7949 17.0809 14.4591 16.6667 14.4591H16.375V9.16748C16.375 5.9004 13.9174 3.20733 10.75 2.83613V2.29248ZM14.875 14.4591V9.16748C14.875 6.47509 12.6924 4.29248 10 4.29248C7.30765 4.29248 5.12504 6.47509 5.12504 9.16748V14.4591H14.875ZM8.00004 17.7085C8.00004 18.1228 8.33583 18.4585 8.75004 18.4585H11.25C11.6643 18.4585 12 18.1228 12 17.7085C12 17.2943 11.6643 16.9585 11.25 16.9585H8.75004C8.33583 16.9585 8.00004 17.2943 8.00004 17.7085Z"
            fill="currentColor"
          />
        </svg>
      </button>
      <Dropdown
        isOpen={isOpen}
        onClose={closeDropdown}
        className="absolute -right-[240px] mt-[17px] flex h-[480px] w-[350px] flex-col rounded-2xl border border-gray-200 bg-white p-3 shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark sm:w-[361px] lg:right-0"
      >
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-100 dark:border-gray-700">
          <div>
            <h5 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
              Notifications
            </h5>
            {counts?.total > 0 && (
              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex-wrap">
                {counts.disputes > 0 && (
                  <span className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-500"></span>
                    {counts.disputes} dispute{counts.disputes > 1 ? "s" : ""}
                  </span>
                )}
                {counts.complaints > 0 && (
                  <span className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-orange-500"></span>
                    {counts.complaints} complaint{counts.complaints > 1 ? "s" : ""}
                  </span>
                )}
                {counts.expiring > 0 && (
                  <span className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-yellow-500"></span>
                    {counts.expiring} expiring
                  </span>
                )}
                {counts.lostFound > 0 && (
                  <span className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-500"></span>
                    {counts.lostFound} lost item{counts.lostFound > 1 ? "s" : ""}
                  </span>
                )}
                {counts.violations > 0 && (
                  <span className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-purple-500"></span>
                    {counts.violations} violation{counts.violations > 1 ? "s" : ""}
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {counts?.total > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                disabled={markingRead}
                className="text-xs text-brand-500 hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300 font-medium disabled:opacity-50"
              >
                Mark all read
              </button>
            )}
            <button
              onClick={toggleDropdown}
              className="text-gray-500 transition dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            >
              <svg
                className="fill-current"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M6.21967 7.28131C5.92678 6.98841 5.92678 6.51354 6.21967 6.22065C6.51256 5.92775 6.98744 5.92775 7.28033 6.22065L11.999 10.9393L16.7176 6.22078C17.0105 5.92789 17.4854 5.92788 17.7782 6.22078C18.0711 6.51367 18.0711 6.98855 17.7782 7.28144L13.0597 12L17.7782 16.7186C18.0711 17.0115 18.0711 17.4863 17.7782 17.7792C17.4854 18.0721 17.0105 18.0721 16.7176 17.7792L11.999 13.0607L7.28033 17.7794C6.98744 18.0722 6.51256 18.0722 6.21967 17.7794C5.92678 17.4865 5.92678 17.0116 6.21967 16.7187L10.9384 12L6.21967 7.28131Z"
                  fill="currentColor"
                />
              </svg>
            </button>
          </div>
        </div>
        <ul className="flex flex-col h-auto overflow-y-auto custom-scrollbar">
          {loading ? (
            <li className="py-10 text-center text-gray-400 dark:text-gray-500">
              <div className="flex justify-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-500"></div>
              </div>
            </li>
          ) : notifications.length === 0 ? (
            <li className="py-10 text-center text-gray-400 dark:text-gray-500">
              <svg
                className="w-12 h-12 mx-auto mb-2 text-gray-300 dark:text-gray-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              </svg>
              <p className="text-sm">No new notifications</p>
            </li>
          ) : (
            notifications.map((notification, index) => (
              <li key={notification._id || index} className={notification.isRead ? "opacity-60" : ""}>
                <DropdownItem
                  onItemClick={closeDropdown}
                  className={`flex gap-3 rounded-lg border-b border-gray-100 p-3 px-4.5 py-3 hover:bg-gray-100 dark:border-gray-800 dark:hover:bg-white/5 ${
                    notification.isRead ? "bg-gray-50 dark:bg-gray-800/30" : ""
                  }`}
                >
                  <Link
                    to={
                      notification.type === "dispute"
                        ? "/bookings"
                        : notification.type === "complaint"
                        ? "/complaints"
                        : notification.type === "lostfound"
                        ? "/lost-found"
                        : notification.type === "violation" || notification.type === "resolved"
                        ? "/complaints"
                        : "/announcements"
                    }
                    className="flex gap-3 w-full"
                  >
                    {/* Icon */}
                    <span
                      className={`flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-full ${
                        notification.type === "dispute"
                          ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                          : notification.type === "complaint"
                          ? "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"
                          : notification.type === "lostfound"
                          ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                          : notification.type === "violation"
                          ? "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
                          : notification.type === "resolved"
                          ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400"
                      }`}
                    >
                      {notification.type === "dispute" ? (
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                          />
                        </svg>
                      ) : notification.type === "complaint" ? (
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                          />
                        </svg>
                      ) : notification.type === "lostfound" ? (
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                          />
                        </svg>
                      ) : notification.type === "violation" ? (
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                          />
                        </svg>
                      ) : notification.type === "resolved" ? (
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      ) : (
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      )}
                    </span>

                    {/* Content */}
                    <span className="block flex-1 min-w-0">
                      {notification.type === "dispute" ? (
                        <>
                          <span className="mb-1 block text-theme-sm text-gray-500 dark:text-gray-400">
                            <span className="font-medium text-gray-800 dark:text-white/90">
                              Booking Dispute
                            </span>
                            <span className="block truncate">
                              {notification.booking?.passenger?.firstname || notification.user?.firstname || "User"}{" "}
                              reported a dispute
                            </span>
                          </span>
                          <span className="flex items-center gap-2 text-gray-500 text-theme-xs dark:text-gray-400">
                            <span
                              className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                notification.booking?.disputeReason === "Not at Destination"
                                  ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                                  : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                              }`}
                            >
                              {notification.booking?.disputeReason || notification.reason || "Dispute"}
                            </span>
                            <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                            <span>{formatTimeAgo(notification.createdAt)}</span>
                          </span>
                        </>
                      ) : notification.type === "complaint" ? (
                        <>
                          <span className="mb-1 block text-theme-sm text-gray-500 dark:text-gray-400">
                            <span className="font-medium text-gray-800 dark:text-white/90">
                              {notification.title || "New Complaint"}
                            </span>
                            <span className="block truncate">
                              Against {notification.driver?.firstname || "Driver"} {notification.driver?.lastname || ""}
                            </span>
                          </span>
                          <span className="flex items-center gap-2 text-gray-500 text-theme-xs dark:text-gray-400">
                            <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              notification.priority === "high"
                                ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                : notification.priority === "medium"
                                ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                                : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                            }`}>
                              {notification.complaint?.categoryLabel || notification.complaint?.category || "Complaint"}
                            </span>
                            <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                            <span>{formatTimeAgo(notification.createdAt)}</span>
                          </span>
                        </>
                      ) : notification.type === "lostfound" ? (
                        <>
                          <span className="mb-1 block text-theme-sm text-gray-500 dark:text-gray-400">
                            <span className="font-medium text-gray-800 dark:text-white/90">
                              {notification.title || "Lost & Found"}
                            </span>
                            <span className="block truncate">
                              {notification.lostFound?.title || "Item"}
                            </span>
                          </span>
                          <span className="flex items-center gap-2 text-gray-500 text-theme-xs dark:text-gray-400">
                            <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              notification.lostFound?.status === "returned"
                                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                : notification.lostFound?.status === "claimed"
                                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                                : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                            }`}>
                              {notification.lostFound?.status || "Posted"}
                            </span>
                            <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                            <span>{formatTimeAgo(notification.createdAt)}</span>
                          </span>
                        </>
                      ) : notification.type === "violation" ? (
                        <>
                          <span className="mb-1 block text-theme-sm text-gray-500 dark:text-gray-400">
                            <span className="font-medium text-gray-800 dark:text-white/90">
                              {notification.title || "Driver Violation"}
                            </span>
                            <span className="block truncate">
                              {notification.driver?.firstname || "Driver"} {notification.driver?.lastname || ""}
                            </span>
                          </span>
                          <span className="flex items-center gap-2 text-gray-500 text-theme-xs dark:text-gray-400">
                            <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                              {notification.complaint?.actionTaken?.replace(/_/g, " ") || "Action Taken"}
                            </span>
                            <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                            <span>{formatTimeAgo(notification.createdAt)}</span>
                          </span>
                        </>
                      ) : notification.type === "resolved" ? (
                        <>
                          <span className="mb-1 block text-theme-sm text-gray-500 dark:text-gray-400">
                            <span className="font-medium text-gray-800 dark:text-white/90">
                              {notification.title || "Complaint Resolved"}
                            </span>
                            <span className="block truncate">
                              {notification.complaint?.categoryLabel || "Complaint"} - {notification.driver?.firstname || "Driver"}
                            </span>
                          </span>
                          <span className="flex items-center gap-2 text-gray-500 text-theme-xs dark:text-gray-400">
                            <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              notification.complaint?.status === "resolved"
                                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                            }`}>
                              {notification.complaint?.status || "Resolved"}
                            </span>
                            <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                            <span>{formatTimeAgo(notification.createdAt)}</span>
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="mb-1 block text-theme-sm text-gray-500 dark:text-gray-400">
                            <span className="font-medium text-gray-800 dark:text-white/90">
                              Announcement Expiring
                            </span>
                            <span className="block truncate">
                              {notification.announcement?.title || "Announcement"}
                            </span>
                          </span>
                          <span className="flex items-center gap-2 text-gray-500 text-theme-xs dark:text-gray-400">
                            <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                              {formatExpiryTime(notification.announcement?.endDate || notification.announcement?.expiryDate)}
                            </span>
                            <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                            <span>
                              Ends{" "}
                              {new Date(
                                notification.announcement?.endDate || notification.announcement?.expiryDate
                              ).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                              })}
                            </span>
                          </span>
                        </>
                      )}
                    </span>
                  </Link>
                  
                  {/* Mark as read button */}
                  {!notification.isRead && (
                    <button
                      onClick={(e) => handleMarkAsRead(e, notification._id)}
                      disabled={markingRead}
                      className="flex-shrink-0 p-1.5 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors disabled:opacity-50"
                      title="Mark as read"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                  
                  {/* Read indicator */}
                  {notification.isRead && (
                    <span className="flex-shrink-0 p-1.5 text-green-500" title="Read">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                  )}
                </DropdownItem>
              </li>
            ))
          )}
        </ul>

        <div className="flex gap-2 mt-3">
          <Link
            to="/notifications"
            onClick={closeDropdown}
            className="flex-1 px-4 py-2 text-sm font-medium text-center text-white bg-brand-500 hover:bg-brand-600 rounded-lg transition-colors"
          >
            View All Notifications
          </Link>
        </div>
      </Dropdown>
    </div>
  );
}
