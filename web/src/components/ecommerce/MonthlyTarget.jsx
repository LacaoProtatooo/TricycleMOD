import Chart from "react-apexcharts";
import { useState, useMemo } from "react";
import { Dropdown } from "../ui/dropdown/Dropdown";
import { DropdownItem } from "../ui/dropdown/DropdownItem";
import { MoreDotIcon } from "../../icons";

export default function MonthlyTarget({ stats, loading }) {
  const [isOpen, setIsOpen] = useState(false);

  // Calculate current month's performance
  const currentMonthIndex = stats?.monthlyRevenue?.currentMonth ?? new Date().getMonth();
  const currentMonthRevenue = stats?.monthlyRevenue?.data?.[currentMonthIndex] || 0;
  const currentMonthTrips = stats?.monthlyRevenue?.trips?.[currentMonthIndex] || 0;
  
  // Calculate average monthly revenue from past months
  const pastMonthsRevenue = stats?.monthlyRevenue?.data?.slice(0, currentMonthIndex) || [];
  const avgMonthlyRevenue = pastMonthsRevenue.length > 0 
    ? pastMonthsRevenue.reduce((sum, val) => sum + val, 0) / pastMonthsRevenue.length 
    : 0;
  
  // Calculate progress percentage (current month vs average)
  const progressPercent = avgMonthlyRevenue > 0 
    ? Math.min(Math.round((currentMonthRevenue / avgMonthlyRevenue) * 100), 150) 
    : (currentMonthRevenue > 0 ? 100 : 0);

  const series = [progressPercent];
  const options = {
    colors: [progressPercent >= 100 ? "#10B981" : "#465FFF"],
    chart: {
      fontFamily: "Outfit, sans-serif",
      type: "radialBar",
      height: 330,
      sparkline: {
        enabled: true,
      },
    },
    plotOptions: {
      radialBar: {
        startAngle: -85,
        endAngle: 85,
        hollow: {
          size: "80%",
        },
        track: {
          background: "#E4E7EC",
          strokeWidth: "100%",
          margin: 5,
        },
        dataLabels: {
          name: {
            show: false,
          },
          value: {
            fontSize: "36px",
            fontWeight: "600",
            offsetY: -40,
            color: "#1D2939",
            formatter: function (val) {
              return val + "%";
            },
          },
        },
      },
    },
    fill: {
      type: "solid",
      colors: [progressPercent >= 100 ? "#10B981" : "#465FFF"],
    },
    stroke: {
      lineCap: "round",
    },
    labels: ["Progress"],
  };

  function toggleDropdown() {
    setIsOpen(!isOpen);
  }

  function closeDropdown() {
    setIsOpen(false);
  }

  const formatCurrency = (amount) => {
    if (amount === undefined || amount === null) return '₱0';
    if (amount >= 1000) {
      return `₱${(amount / 1000).toFixed(1)}K`;
    }
    return `₱${amount.toLocaleString()}`;
  };

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                      'July', 'August', 'September', 'October', 'November', 'December'];
  const currentMonthName = monthNames[currentMonthIndex];

  const isAboveAverage = currentMonthRevenue > avgMonthlyRevenue;

  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-100 dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="px-5 pt-5 bg-white shadow-default rounded-2xl pb-11 dark:bg-gray-900 sm:px-6 sm:pt-6">
        <div className="flex justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
              {currentMonthName} Performance
            </h3>
            <p className="mt-1 text-gray-500 text-theme-sm dark:text-gray-400">
              Compared to monthly average
            </p>
          </div>
          <div className="relative inline-block">
            <button className="dropdown-toggle" onClick={toggleDropdown}>
              <MoreDotIcon className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 size-6" />
            </button>
            <Dropdown
              isOpen={isOpen}
              onClose={closeDropdown}
              className="w-40 p-2"
            >
              <DropdownItem
                onItemClick={closeDropdown}
                className="flex w-full font-normal text-left text-gray-500 rounded-lg hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
              >
                View Details
              </DropdownItem>
            </Dropdown>
          </div>
        </div>
        <div className="relative">
          <div className="max-h-[330px]" id="chartDarkStyle">
            {loading ? (
              <div className="flex items-center justify-center h-[330px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              </div>
            ) : (
              <Chart
                options={options}
                series={series}
                type="radialBar"
                height={330}
              />
            )}
          </div>

          <span className={`absolute left-1/2 top-full -translate-x-1/2 -translate-y-[95%] rounded-full px-3 py-1 text-xs font-medium ${
            isAboveAverage 
              ? 'bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-500'
              : 'bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-warning-500'
          }`}>
            {isAboveAverage ? 'Above Average' : 'Building Up'}
          </span>
        </div>
        <p className="mx-auto mt-10 w-full max-w-[380px] text-center text-sm text-gray-500 sm:text-base">
          {loading ? 'Loading...' : (
            currentMonthRevenue > 0 
              ? `WEBTTODA earned ${formatCurrency(currentMonthRevenue)} this month from ${currentMonthTrips} completed trips.`
              : 'No completed trips this month yet.'
          )}
        </p>
      </div>

      <div className="flex items-center justify-center gap-5 px-6 py-3.5 sm:gap-8 sm:py-5">
        <div>
          <p className="mb-1 text-center text-gray-500 text-theme-xs dark:text-gray-400 sm:text-sm">
            Avg Monthly
          </p>
          <p className="flex items-center justify-center gap-1 text-base font-semibold text-gray-800 dark:text-white/90 sm:text-lg">
            {loading ? '...' : formatCurrency(avgMonthlyRevenue)}
          </p>
        </div>

        <div className="w-px bg-gray-200 h-7 dark:bg-gray-800"></div>

        <div>
          <p className="mb-1 text-center text-gray-500 text-theme-xs dark:text-gray-400 sm:text-sm">
            This Month
          </p>
          <p className="flex items-center justify-center gap-1 text-base font-semibold text-gray-800 dark:text-white/90 sm:text-lg">
            {loading ? '...' : formatCurrency(currentMonthRevenue)}
            {!loading && currentMonthRevenue > avgMonthlyRevenue && avgMonthlyRevenue > 0 && (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path fillRule="evenodd" clipRule="evenodd" d="M7.60141 2.33683C7.73885 2.18084 7.9401 2.08243 8.16435 2.08243C8.16475 2.08243 8.16516 2.08243 8.16556 2.08243C8.35773 2.08219 8.54998 2.15535 8.69664 2.30191L12.6968 6.29924C12.9898 6.59203 12.9899 7.0669 12.6971 7.3599C12.4044 7.6529 11.9295 7.65306 11.6365 7.36027L8.91435 4.64004L8.91435 13.5C8.91435 13.9142 8.57856 14.25 8.16435 14.25C7.75013 14.25 7.41435 13.9142 7.41435 13.5L7.41435 4.64442L4.69679 7.36025C4.4038 7.65305 3.92893 7.6529 3.63613 7.35992C3.34333 7.06693 3.34348 6.59206 3.63646 6.29926L7.60141 2.33683Z" fill="#039855"/>
              </svg>
            )}
          </p>
        </div>

        <div className="w-px bg-gray-200 h-7 dark:bg-gray-800"></div>

        <div>
          <p className="mb-1 text-center text-gray-500 text-theme-xs dark:text-gray-400 sm:text-sm">
            Trips
          </p>
          <p className="flex items-center justify-center gap-1 text-base font-semibold text-gray-800 dark:text-white/90 sm:text-lg">
            {loading ? '...' : currentMonthTrips}
          </p>
        </div>
      </div>
    </div>
  );
}
