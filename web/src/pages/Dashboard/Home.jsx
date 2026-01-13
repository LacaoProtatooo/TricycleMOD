import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import EcommerceMetrics from "../../components/ecommerce/EcommerceMetrics";
import MonthlySalesChart from "../../components/ecommerce/MonthlySalesChart";
import StatisticsChart from "../../components/ecommerce/StatisticsChart";
import MonthlyTarget from "../../components/ecommerce/MonthlyTarget";
import RecentOrders from "../../components/ecommerce/RecentOrders";
import DemographicCard from "../../components/ecommerce/DemographicCard";
import SatisfactionOverview from "../../components/ecommerce/SatisfactionOverview";
import PageMeta from "../../components/common/PageMeta";
import { fetchDashboardStats } from "../../redux/actions/dashboardAction";

export default function Home() {
  const dispatch = useDispatch();
  const { stats, loading } = useSelector((state) => state.dashboard);
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);

  // Generate available years (current year and 5 years back)
  const availableYears = Array.from({ length: 6 }, (_, i) => currentYear - i);

  useEffect(() => {
    dispatch(fetchDashboardStats(selectedYear));
  }, [dispatch, selectedYear]);

  const handleYearChange = (year) => {
    setSelectedYear(year);
  };

  return (
    <>
      <PageMeta
        title="Admin Dashboard | TricycleMOD"
        description="TricycleMOD Admin Dashboard"
      />
      <div className="grid grid-cols-12 gap-4 md:gap-6">
        <div className="col-span-12 space-y-6 xl:col-span-7">
          <EcommerceMetrics stats={stats} loading={loading} />

          <MonthlySalesChart 
            stats={stats} 
            loading={loading} 
            selectedYear={selectedYear}
            availableYears={availableYears}
            onYearChange={handleYearChange}
          />
        </div>

        <div className="col-span-12 xl:col-span-5">
          <MonthlyTarget 
            stats={stats} 
            loading={loading}
            selectedYear={selectedYear}
            availableYears={availableYears}
            onYearChange={handleYearChange}
          />
        </div>

        <div className="col-span-12 xl:col-span-5">
          <SatisfactionOverview stats={stats} loading={loading} />
        </div>

        <div className="col-span-12 xl:col-span-7">
          <StatisticsChart 
            stats={stats} 
            loading={loading}
            selectedYear={selectedYear}
          />
        </div>

        {/* <div className="col-span-12 xl:col-span-5">
          <DemographicCard />
        </div>

        <div className="col-span-12 xl:col-span-7">
          <RecentOrders />
        </div> */}
      </div>
    </>
  );
}
