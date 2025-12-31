import { useState } from "react";
import {
  BoxIconLine,
  GroupIcon,
} from "../../icons";

// Icons for the metrics
const UsersIcon = () => (
  <svg className="text-gray-800 size-6 dark:text-white/90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);

const DriverIcon = () => (
  <svg className="text-gray-800 size-6 dark:text-white/90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

const OperatorIcon = () => (
  <svg className="text-gray-800 size-6 dark:text-white/90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
  </svg>
);

const TricycleIcon = () => (
  <svg className="text-gray-800 size-6 dark:text-white/90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
  </svg>
);

const RevenueIcon = () => (
  <svg className="text-gray-800 size-6 dark:text-white/90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const InfoIcon = () => (
  <svg className="size-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-help" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

export default function EcommerceMetrics({ stats, loading }) {
  const [showTooltip, setShowTooltip] = useState(false);

  const formatNumber = (num) => {
    if (num === undefined || num === null) return '0';
    return num.toLocaleString();
  };

  const formatCurrency = (amount) => {
    if (amount === undefined || amount === null) return '₱0.00';
    return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 md:gap-6">
      {/* Total Users */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
        <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-xl dark:bg-blue-900/30">
          <UsersIcon />
        </div>
        <div className="mt-5">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Total Users
          </span>
          <h4 className="mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
            {loading ? '...' : formatNumber(stats?.users?.total)}
          </h4>
        </div>
      </div>

      {/* Total Drivers */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
        <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-xl dark:bg-green-900/30">
          <DriverIcon />
        </div>
        <div className="mt-5">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Total Drivers
          </span>
          <h4 className="mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
            {loading ? '...' : formatNumber(stats?.users?.drivers)}
          </h4>
        </div>
      </div>

      {/* Total Operators */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
        <div className="flex items-center justify-center w-12 h-12 bg-purple-100 rounded-xl dark:bg-purple-900/30">
          <OperatorIcon />
        </div>
        <div className="mt-5">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Total Operators
          </span>
          <h4 className="mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
            {loading ? '...' : formatNumber(stats?.users?.operators)}
          </h4>
        </div>
      </div>

      {/* Total Tricycles */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
        <div className="flex items-center justify-center w-12 h-12 bg-orange-100 rounded-xl dark:bg-orange-900/30">
          <TricycleIcon />
        </div>
        <div className="mt-5">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Total Tricycles
          </span>
          <h4 className="mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
            {loading ? '...' : formatNumber(stats?.tricycles?.total)}
          </h4>
        </div>
      </div>

      {/* Total Revenue with Tooltip */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6 sm:col-span-2 lg:col-span-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center justify-center w-12 h-12 bg-emerald-100 rounded-xl dark:bg-emerald-900/30">
            <RevenueIcon />
          </div>
          <div 
            className="relative"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
          >
            <InfoIcon />
            {showTooltip && (
              <div className="absolute right-0 top-6 z-50 w-64 p-3 bg-gray-800 text-white text-xs rounded-lg shadow-lg dark:bg-gray-700">
                <p className="font-semibold mb-1">How Total Revenue is Computed:</p>
                <p>Sum of all <span className="text-emerald-400">agreedFare</span> values from completed bookings (status: "completed").</p>
                <p className="mt-2 text-gray-300">Total Trips: {stats?.revenue?.totalTrips || 0}</p>
                <p className="text-gray-300">Average Fare: {formatCurrency(stats?.revenue?.avgFare)}</p>
                <div className="absolute -top-1 right-2 w-2 h-2 bg-gray-800 dark:bg-gray-700 rotate-45"></div>
              </div>
            )}
          </div>
        </div>
        <div className="mt-5">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Total Revenue
          </span>
          <h4 className="mt-2 font-bold text-emerald-600 text-title-sm dark:text-emerald-400">
            {loading ? '...' : formatCurrency(stats?.revenue?.total)}
          </h4>
          <p className="text-xs text-gray-400 mt-1">
            From {stats?.revenue?.totalTrips || 0} completed trips
          </p>
        </div>
      </div>
    </div>
  );
}
