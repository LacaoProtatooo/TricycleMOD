import { useState, useEffect } from "react";
import axios from "axios";
import { getToken } from "../redux/actions/authAction";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const MEDAL_COLORS = [
  "bg-red-100 text-red-700 border-red-300 dark:bg-red-900/40 dark:text-red-300 dark:border-red-700",
  "bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/40 dark:text-orange-300 dark:border-orange-700",
  "bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-900/40 dark:text-yellow-300 dark:border-yellow-700",
];

const RANK_BADGES = ["🥇", "🥈", "🥉"];

/**
 * DriverRankingPanel
 *
 * Props:
 *  - type: "violations" | "complaints"
 *  - limit: number (default 10)
 */
const DriverRankingPanel = ({ type = "violations", limit = 10 }) => {
  const [ranking, setRanking] = useState([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    fetchRanking();
  }, [type, limit]);

  const fetchRanking = async () => {
    setLoading(true);
    try {
      const token = getToken();
      const url =
        type === "violations"
          ? `${API_URL}/violations/ranking?limit=${limit}`
          : `${API_URL}/complaints/admin/ranking?limit=${limit}`;

      const response = await axios.get(url, {
        headers: { Authorization: token ? `Bearer ${token}` : "" },
      });

      setRanking(response.data.ranking || []);
    } catch (err) {
      console.error(`Failed to fetch ${type} ranking:`, err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const isViolations = type === "violations";
  const title = isViolations ? "Most Violated Drivers" : "Most Complained Drivers";
  const icon = isViolations ? (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ) : (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
    </svg>
  );

  return (
    <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
      {/* Header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
            isViolations
              ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
              : "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"
          }`}>
            {icon}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Top {limit} drivers by {isViolations ? "violation" : "complaint"} count
            </p>
          </div>
        </div>
        <svg
          className={`h-5 w-5 text-gray-400 transition-transform ${collapsed ? "" : "rotate-180"}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Body */}
      {!collapsed && (
        <div className="border-t border-gray-200 dark:border-gray-700">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <svg className="h-5 w-5 animate-spin text-brand-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
          ) : ranking.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
              No {isViolations ? "violations" : "complaints"} recorded yet
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {ranking.map((item, index) => {
                const driver = item.driver;
                const count = isViolations ? item.totalViolations : item.totalComplaints;
                const isTopThree = index < 3;

                return (
                  <div
                    key={item._id}
                    className={`flex items-center gap-3 px-5 py-3 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50 ${
                      isTopThree ? "bg-gray-50/50 dark:bg-gray-800/20" : ""
                    }`}
                  >
                    {/* Rank */}
                    <div className="flex-shrink-0 w-8 text-center">
                      {isTopThree ? (
                        <span className="text-lg">{RANK_BADGES[index]}</span>
                      ) : (
                        <span className="text-sm font-bold text-gray-400 dark:text-gray-500">
                          {index + 1}
                        </span>
                      )}
                    </div>

                    {/* Avatar */}
                    <img
                      src={driver?.image?.url || "/images/user/default-avatar.png"}
                      alt=""
                      className="h-9 w-9 flex-shrink-0 rounded-full object-cover ring-2 ring-white dark:ring-gray-800"
                    />

                    {/* Driver Info */}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                        {driver?.firstname} {driver?.lastname}
                      </p>
                      <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                        {driver?.email}
                      </p>
                    </div>

                    {/* Count Badge */}
                    <div className="flex flex-col items-end gap-1">
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${
                          isTopThree
                            ? MEDAL_COLORS[index]
                            : "bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600"
                        }`}
                      >
                        {count} {isViolations ? (count === 1 ? "violation" : "violations") : (count === 1 ? "complaint" : "complaints")}
                      </span>

                      {/* Sub-stats */}
                      <div className="flex items-center gap-2 text-[10px] text-gray-400 dark:text-gray-500">
                        {isViolations ? (
                          <>
                            {item.suspensions > 0 && (
                              <span className="text-orange-500">{item.suspensions} susp</span>
                            )}
                            {item.warnings > 0 && (
                              <span className="text-yellow-500">{item.warnings} warn</span>
                            )}
                            {item.dismissals > 0 && (
                              <span className="text-red-500">{item.dismissals} dism</span>
                            )}
                          </>
                        ) : (
                          <>
                            {item.pending > 0 && (
                              <span className="text-yellow-500">{item.pending} pending</span>
                            )}
                            {item.resolved > 0 && (
                              <span className="text-green-500">{item.resolved} resolved</span>
                            )}
                          </>
                        )}
                        <span>
                          Latest: {formatDate(isViolations ? item.latestViolation : item.latestComplaint)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DriverRankingPanel;
