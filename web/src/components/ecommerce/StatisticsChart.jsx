import Chart from "react-apexcharts";
import { useState } from "react";

const InfoIcon = () => (
  <svg className="size-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-help" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

export default function StatisticsChart({ stats, loading, selectedYear }) {
  const [showTooltip, setShowTooltip] = useState(false);
  // Get monthly data from stats
  const monthlyTrips = stats?.monthlyRevenue?.trips || Array(12).fill(0);
  const monthlyComplaints = stats?.complaints?.monthly || Array(12).fill(0);

  const options = {
    legend: {
      show: true,
      position: "top",
      horizontalAlign: "left",
    },
    colors: ["#465FFF", "#EF4444"], // Blue for trips, Red for complaints
    chart: {
      fontFamily: "Outfit, sans-serif",
      height: 310,
      type: "line",
      toolbar: {
        show: false,
      },
    },
    stroke: {
      curve: "smooth",
      width: [3, 2],
    },

    fill: {
      type: "gradient",
      gradient: {
        opacityFrom: 0.55,
        opacityTo: 0,
      },
    },
    markers: {
      size: 0,
      strokeColors: "#fff",
      strokeWidth: 2,
      hover: {
        size: 6,
      },
    },
    grid: {
      xaxis: {
        lines: {
          show: false,
        },
      },
      yaxis: {
        lines: {
          show: true,
        },
      },
    },
    dataLabels: {
      enabled: false,
    },
    tooltip: {
      enabled: true,
      shared: true,
      intersect: false,
    },
    xaxis: {
      type: "category",
      categories: [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ],
      axisBorder: {
        show: false,
      },
      axisTicks: {
        show: false,
      },
      tooltip: {
        enabled: false,
      },
    },
    yaxis: [
      {
        title: {
          text: "Completed Trips",
          style: {
            fontSize: "12px",
            color: "#465FFF",
          },
        },
        labels: {
          style: {
            fontSize: "12px",
            colors: ["#6B7280"],
          },
        },
      },
      {
        opposite: true,
        title: {
          text: "Complaints",
          style: {
            fontSize: "12px",
            color: "#EF4444",
          },
        },
        labels: {
          style: {
            fontSize: "12px",
            colors: ["#6B7280"],
          },
        },
      },
    ],
  };

  const series = [
    {
      name: "Completed Trips",
      data: monthlyTrips,
    },
    {
      name: "Complaints",
      data: monthlyComplaints,
    },
  ];

  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white px-5 pb-5 pt-5 dark:border-gray-800 dark:bg-white/[0.03] sm:px-6 sm:pt-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-2 dark:bg-gray-700"></div>
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-6 dark:bg-gray-700"></div>
          <div className="h-[310px] bg-gray-200 rounded dark:bg-gray-700"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white px-5 pb-5 pt-5 dark:border-gray-800 dark:bg-white/[0.03] sm:px-6 sm:pt-6">
      <div className="flex flex-col gap-5 mb-6 sm:flex-row sm:justify-between">
        <div className="w-full">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
              Trips & Complaints Trend
            </h3>
            <div 
              className="relative"
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
            >
              <InfoIcon />
              {showTooltip && (
                <div className="absolute left-0 top-6 z-50 w-72 p-3 bg-gray-800 text-white text-xs rounded-lg shadow-lg dark:bg-gray-700">
                  <p className="font-semibold mb-1">Trips & Complaints Trend Chart</p>
                  <p>Shows correlation between service volume and customer issues throughout the year.</p>
                  <p className="mt-2 text-gray-300"><span className="text-blue-400">Completed Trips:</span> Monthly count of bookings with status "completed"</p>
                  <p className="text-gray-300"><span className="text-red-400">Complaints:</span> Monthly count of filed complaints</p>
                  <p className="mt-1 text-gray-300">Sources: Booking & Complaint collections</p>
                  <div className="absolute -top-1 left-2 w-2 h-2 bg-gray-800 dark:bg-gray-700 rotate-45"></div>
                </div>
              )}
            </div>
          </div>
          <p className="mt-1 text-gray-500 text-theme-sm dark:text-gray-400">
            {selectedYear || new Date().getFullYear()} - Monthly comparison of completed trips vs complaints filed
          </p>
        </div>
        <div className="flex items-start gap-4 sm:justify-end">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[#465FFF]"></span>
            <span className="text-xs text-gray-500 dark:text-gray-400">Trips</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[#EF4444]"></span>
            <span className="text-xs text-gray-500 dark:text-gray-400">Complaints</span>
          </div>
        </div>
      </div>

      <div className="max-w-full overflow-x-auto custom-scrollbar">
        <div className="min-w-[600px] xl:min-w-full">
          <Chart options={options} series={series} type="area" height={310} />
        </div>
      </div>
    </div>
  );
}
