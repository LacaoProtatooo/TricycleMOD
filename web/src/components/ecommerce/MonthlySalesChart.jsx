import Chart from "react-apexcharts";
import { Dropdown } from "../ui/dropdown/Dropdown";
import { DropdownItem } from "../ui/dropdown/DropdownItem";
import { MoreDotIcon } from "../../icons";
import { useState, useMemo } from "react";

const InfoIcon = () => (
  <svg className="size-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-help" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

export default function MonthlySalesChart({ stats, loading, selectedYear, availableYears, onYearChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const [showYearDropdown, setShowYearDropdown] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  const currentYear = new Date().getFullYear();
  const monthlyData = stats?.monthlyRevenue?.data || Array(12).fill(0);
  const currentMonthIndex = stats?.monthlyRevenue?.currentMonth ?? new Date().getMonth();

  // Create colors array - different color for current month (ongoing) vs finished months
  const chartColors = useMemo(() => {
    return monthlyData.map((_, index) => {
      // Only highlight current month if viewing current year
      if (selectedYear === currentYear && index === currentMonthIndex) {
        return '#f59e0b'; // Amber/Orange for current month (ongoing)
      }
      return '#465fff'; // Blue for finished months
    });
  }, [currentMonthIndex, monthlyData, selectedYear, currentYear]);

  const options = {
    colors: chartColors,
    chart: {
      fontFamily: "Outfit, sans-serif",
      type: "bar",
      height: 180,
      toolbar: {
        show: false,
      },
    },
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: "39%",
        borderRadius: 5,
        borderRadiusApplication: "end",
        distributed: true, // Enable distributed colors
      },
    },
    dataLabels: {
      enabled: false,
    },
    stroke: {
      show: true,
      width: 4,
      colors: ["transparent"],
    },
    xaxis: {
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
    },
    legend: {
      show: false, // Hide default legend since we're using distributed colors
    },
    yaxis: {
      title: {
        text: undefined,
      },
      labels: {
        formatter: (val) => `₱${val.toLocaleString()}`,
      },
    },
    grid: {
      yaxis: {
        lines: {
          show: true,
        },
      },
    },
    fill: {
      opacity: 1,
    },
    tooltip: {
      x: {
        show: true,
      },
      y: {
        formatter: (val) => `₱${val.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      },
    },
  };

  const series = [
    {
      name: "Revenue",
      data: monthlyData,
    },
  ];

  function toggleDropdown() {
    setIsOpen(!isOpen);
  }

  function closeDropdown() {
    setIsOpen(false);
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white px-5 pt-5 dark:border-gray-800 dark:bg-white/[0.03] sm:px-6 sm:pt-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
              Monthly Revenue
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {selectedYear} Revenue Overview
            </p>
          </div>
          <div 
            className="relative"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
          >
            <InfoIcon />
            {showTooltip && (
              <div className="absolute left-0 top-6 z-50 w-72 p-3 bg-gray-800 text-white text-xs rounded-lg shadow-lg dark:bg-gray-700">
                <p className="font-semibold mb-1">Monthly Revenue Chart</p>
                <p>Shows revenue from completed bookings grouped by month for the selected year.</p>
                <p className="mt-2 text-gray-300"><span className="text-blue-400">Blue bars:</span> Completed months</p>
                <p className="text-gray-300"><span className="text-amber-400">Amber bar:</span> Current month (ongoing)</p>
                <p className="mt-1 text-gray-300">Source: Completed bookings (agreedFare)</p>
                <div className="absolute -top-1 left-2 w-2 h-2 bg-gray-800 dark:bg-gray-700 rotate-45"></div>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4">
          {/* Year Selector */}
          <div className="relative">
            <button
              onClick={() => setShowYearDropdown(!showYearDropdown)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
            >
              {selectedYear}
              <ChevronDownIcon />
            </button>
            {showYearDropdown && (
              <div className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 min-w-[100px]">
                {availableYears?.map((year) => (
                  <button
                    key={year}
                    onClick={() => {
                      onYearChange(year);
                      setShowYearDropdown(false);
                    }}
                    className={`w-full px-4 py-2 text-sm text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                      year === selectedYear 
                        ? 'text-blue-600 dark:text-blue-400 font-medium bg-blue-50 dark:bg-blue-900/20' 
                        : 'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {year}
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* Legend */}
          <div className="hidden sm:flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-[#465fff]"></span>
              <span className="text-gray-500 dark:text-gray-400">Completed Months</span>
            </div>
            {selectedYear === currentYear && (
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-amber-500"></span>
                <span className="text-gray-500 dark:text-gray-400">Current Month</span>
              </div>
            )}
          </div>
          <div className="relative inline-block">
            {/* <button className="dropdown-toggle" onClick={toggleDropdown}>
              <MoreDotIcon className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 size-6" />
            </button> */}
            {/* <Dropdown
              isOpen={isOpen}
              onClose={closeDropdown}
              className="w-40 p-2"
            >
              <DropdownItem
                onItemClick={closeDropdown}
                className="flex w-full font-normal text-left text-gray-500 rounded-lg hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
              >
                View More
              </DropdownItem>
              <DropdownItem
                onItemClick={closeDropdown}
                className="flex w-full font-normal text-left text-gray-500 rounded-lg hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
              >
                Export Data
              </DropdownItem>
            </Dropdown> */}
          </div>
        </div>
      </div>

      {/* Mobile Legend */}
      <div className="sm:hidden flex items-center gap-4 text-xs mt-3">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-[#465fff]"></span>
          <span className="text-gray-500 dark:text-gray-400">Completed</span>
        </div>
        {selectedYear === currentYear && (
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-amber-500"></span>
            <span className="text-gray-500 dark:text-gray-400">Current</span>
          </div>
        )}
      </div>

      <div className="max-w-full overflow-x-auto custom-scrollbar">
        <div className="-ml-5 min-w-[650px] xl:min-w-full pl-2">
          {loading ? (
            <div className="flex items-center justify-center h-[180px]">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : (
            <Chart options={options} series={series} type="bar" height={180} />
          )}
        </div>
      </div>
    </div>
  );
}
