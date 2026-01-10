import { useState, useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import PageMeta from "../components/common/PageMeta";
import PageBreadcrumb from "../components/common/PageBreadCrumb";
import { Modal } from "../components/ui/modal";
import { useModal } from "../hooks/useModal";
import {
  fetchLeaderboard,
  fetchAllTimeLeaderboard,
  fetchAvailableMonths,
} from "../redux/actions/leaderboardAction";

const Leaderboard = () => {
  const dispatch = useDispatch();
  const certificateRef = useRef(null);
  
  const {
    leaderboard,
    period,
    loading,
    error,
    allTimeLeaderboard,
    allTimeLoading,
    availableMonths,
    monthsLoading,
  } = useSelector((state) => state.leaderboard);

  // Tab state
  const [activeTab, setActiveTab] = useState("monthly");
  
  // Filter state
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedYear, setSelectedYear] = useState("");

  // Certificate modal
  const { isOpen: isCertificateOpen, openModal: openCertificateModal, closeModal: closeCertificateModal } = useModal();
  const [certificateData, setCertificateData] = useState(null);

  // Fetch available months on mount
  useEffect(() => {
    dispatch(fetchAvailableMonths());
  }, [dispatch]);

  // Fetch leaderboard based on active tab
  useEffect(() => {
    if (activeTab === "monthly") {
      dispatch(fetchLeaderboard({ month: selectedMonth, year: selectedYear }));
    } else {
      dispatch(fetchAllTimeLeaderboard({}));
    }
  }, [dispatch, activeTab, selectedMonth, selectedYear]);

  // Get current leaderboard data based on active tab
  const currentLeaderboard = activeTab === "monthly" ? leaderboard : allTimeLeaderboard;
  const isLoading = activeTab === "monthly" ? loading : allTimeLoading;
  
  // Get the top driver (highest trip count)
  const topDriver = currentLeaderboard?.[0] || null;

  // Handle generate certificate for top driver
  const handleGenerateCertificate = () => {
    if (topDriver) {
      setCertificateData({
        name: `${topDriver.firstname} ${topDriver.lastname}`,
        trips: activeTab === "monthly" ? topDriver.monthlyTrips : topDriver.totalTrips,
        rank: 1,
        period: activeTab === "monthly" 
          ? `${period?.monthName} ${period?.year}` 
          : "All Time",
        date: new Date().toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        }),
      });
      openCertificateModal();
    }
  };

  // Download certificate as image
  const downloadCertificate = async () => {
    if (certificateRef.current) {
      try {
        // Dynamically import html2canvas
        const html2canvas = (await import('html2canvas')).default;
        
        const canvas = await html2canvas(certificateRef.current, {
          scale: 2,
          backgroundColor: null,
          logging: false,
        });
        
        const link = document.createElement('a');
        link.download = `certificate_${certificateData.name.replace(/\s+/g, '_')}_${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      } catch (err) {
        console.error('Error generating certificate:', err);
        alert('Failed to generate certificate. Please try again.');
      }
    }
  };

  // Print certificate
  const printCertificate = () => {
    const printContent = certificateRef.current;
    if (printContent) {
      const printWindow = window.open('', '', 'width=900,height=700');
      printWindow.document.write(`
        <html>
          <head>
            <title>Certificate - ${certificateData.name}</title>
            <style>
              body { margin: 0; padding: 20px; font-family: 'Times New Roman', serif; }
              .certificate { 
                width: 800px; 
                padding: 40px; 
                border: 8px double #DAA520; 
                background: linear-gradient(135deg, #fffef0 0%, #fff8dc 100%);
                text-align: center;
                position: relative;
              }
              .certificate::before {
                content: '';
                position: absolute;
                top: 15px; left: 15px; right: 15px; bottom: 15px;
                border: 2px solid #DAA520;
              }
              .title { font-size: 48px; color: #8B4513; margin-bottom: 10px; font-weight: bold; }
              .subtitle { font-size: 24px; color: #666; margin-bottom: 30px; }
              .presented { font-size: 18px; color: #444; margin: 20px 0; }
              .name { font-size: 36px; color: #2C5282; font-weight: bold; margin: 20px 0; border-bottom: 2px solid #DAA520; display: inline-block; padding: 0 20px 10px; }
              .achievement { font-size: 20px; color: #444; margin: 20px 0; line-height: 1.6; }
              .trips { font-size: 28px; color: #38A169; font-weight: bold; }
              .footer { margin-top: 40px; display: flex; justify-content: space-between; padding: 0 60px; }
              .footer-item { text-align: center; }
              .footer-label { font-size: 14px; color: #666; border-top: 1px solid #999; padding-top: 5px; margin-top: 30px; }
              .seal { font-size: 60px; margin: 20px 0; }
            </style>
          </head>
          <body>
            ${printContent.innerHTML}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
    }
  };

  const getRankBadge = (rank) => {
    switch (rank) {
      case 1:
        return (
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-yellow-100 dark:bg-yellow-900/30">
            <span className="text-xl">🥇</span>
          </span>
        );
      case 2:
        return (
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700">
            <span className="text-xl">🥈</span>
          </span>
        );
      case 3:
        return (
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/30">
            <span className="text-xl">🥉</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-semibold text-sm">
            {rank}
          </span>
        );
    }
  };

  return (
    <>
      <PageMeta
        title="Leaderboard | TricycleMOD Admin"
        description="Driver leaderboard rankings"
      />
      <PageBreadcrumb pageTitle="Leaderboard" />

      <div className="space-y-6">
        {/* Header with Generate Certificate Button */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Driver Leaderboard
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Top performing drivers based on trip count
            </p>
          </div>
          
          {topDriver && (
            <button
              onClick={handleGenerateCertificate}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white rounded-lg font-medium shadow-lg transition-all duration-200 transform hover:scale-105"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
              Generate Certificate for #1
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab("monthly")}
            className={`px-4 py-2 font-medium text-sm rounded-t-lg transition-colors ${
              activeTab === "monthly"
                ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-b-2 border-blue-600"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            Monthly Rankings
          </button>
          <button
            onClick={() => setActiveTab("all-time")}
            className={`px-4 py-2 font-medium text-sm rounded-t-lg transition-colors ${
              activeTab === "all-time"
                ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-b-2 border-blue-600"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            All-Time Rankings
          </button>
        </div>

        {/* Month/Year Filter (only for monthly tab) */}
        {activeTab === "monthly" && (
          <div className="flex flex-wrap gap-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Period:
              </label>
              <select
                value={`${selectedMonth}-${selectedYear}`}
                onChange={(e) => {
                  const [month, year] = e.target.value.split('-');
                  setSelectedMonth(month);
                  setSelectedYear(year);
                }}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={monthsLoading}
              >
                <option value="-">Current Month</option>
                {availableMonths.map((m) => (
                  <option key={`${m.month}-${m.year}`} value={`${m.month}-${m.year}`}>
                    {m.monthName} {m.year} ({m.tripCount} trips)
                  </option>
                ))}
              </select>
            </div>
            
            {period && (
              <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                Showing: <span className="font-semibold ml-1">{period.monthName} {period.year}</span>
              </div>
            )}
          </div>
        )}

        {/* Top 3 Podium */}
        {currentLeaderboard.length >= 3 && !isLoading && (
          <div className="flex justify-center items-end gap-4 py-8">
            {/* 2nd Place */}
            <div className="flex flex-col items-center">
              <div className="w-20 h-20 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden mb-2 ring-4 ring-gray-400">
                {currentLeaderboard[1]?.image ? (
                  <img
                    src={currentLeaderboard[1].image}
                    alt={currentLeaderboard[1].firstname}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-gray-500">
                    {currentLeaderboard[1]?.firstname?.[0]}
                  </div>
                )}
              </div>
              <span className="text-2xl mb-1">🥈</span>
              <p className="font-semibold text-gray-900 dark:text-white text-center">
                {currentLeaderboard[1]?.firstname} {currentLeaderboard[1]?.lastname?.[0]}.
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {activeTab === "monthly" ? currentLeaderboard[1]?.monthlyTrips : currentLeaderboard[1]?.totalTrips} trips
              </p>
              <div className="w-24 h-20 bg-gray-300 dark:bg-gray-600 rounded-t-lg mt-2"></div>
            </div>

            {/* 1st Place */}
            <div className="flex flex-col items-center">
              <div className="w-24 h-24 rounded-full bg-yellow-100 dark:bg-yellow-900/30 overflow-hidden mb-2 ring-4 ring-yellow-500 shadow-lg">
                {currentLeaderboard[0]?.image ? (
                  <img
                    src={currentLeaderboard[0].image}
                    alt={currentLeaderboard[0].firstname}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-yellow-600">
                    {currentLeaderboard[0]?.firstname?.[0]}
                  </div>
                )}
              </div>
              <span className="text-3xl mb-1">🥇</span>
              <p className="font-bold text-lg text-gray-900 dark:text-white text-center">
                {currentLeaderboard[0]?.firstname} {currentLeaderboard[0]?.lastname?.[0]}.
              </p>
              <p className="text-sm text-yellow-600 dark:text-yellow-400 font-semibold">
                {activeTab === "monthly" ? currentLeaderboard[0]?.monthlyTrips : currentLeaderboard[0]?.totalTrips} trips
              </p>
              <div className="w-28 h-28 bg-yellow-400 dark:bg-yellow-600 rounded-t-lg mt-2"></div>
            </div>

            {/* 3rd Place */}
            <div className="flex flex-col items-center">
              <div className="w-20 h-20 rounded-full bg-orange-100 dark:bg-orange-900/30 overflow-hidden mb-2 ring-4 ring-orange-400">
                {currentLeaderboard[2]?.image ? (
                  <img
                    src={currentLeaderboard[2].image}
                    alt={currentLeaderboard[2].firstname}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-orange-500">
                    {currentLeaderboard[2]?.firstname?.[0]}
                  </div>
                )}
              </div>
              <span className="text-2xl mb-1">🥉</span>
              <p className="font-semibold text-gray-900 dark:text-white text-center">
                {currentLeaderboard[2]?.firstname} {currentLeaderboard[2]?.lastname?.[0]}.
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {activeTab === "monthly" ? currentLeaderboard[2]?.monthlyTrips : currentLeaderboard[2]?.totalTrips} trips
              </p>
              <div className="w-24 h-16 bg-orange-300 dark:bg-orange-700 rounded-t-lg mt-2"></div>
            </div>
          </div>
        )}

        {/* Leaderboard Table */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden border border-gray-200 dark:border-gray-700">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900/50">
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    Rank
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    Driver
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    {activeTab === "monthly" ? "Monthly Trips" : "Total Trips"}
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                    Rating
                  </th>
                  {activeTab === "monthly" && (
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      All-Time Trips
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {isLoading ? (
                  <tr>
                    <td colSpan={activeTab === "monthly" ? 5 : 4} className="px-6 py-12 text-center">
                      <div className="flex justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                      </div>
                      <p className="mt-2 text-gray-500 dark:text-gray-400">Loading leaderboard...</p>
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={activeTab === "monthly" ? 5 : 4} className="px-6 py-12 text-center text-red-500">
                      {error}
                    </td>
                  </tr>
                ) : currentLeaderboard.length === 0 ? (
                  <tr>
                    <td colSpan={activeTab === "monthly" ? 5 : 4} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                      No data available for this period
                    </td>
                  </tr>
                ) : (
                  currentLeaderboard.map((driver) => (
                    <tr
                      key={driver.driverId}
                      className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                        driver.rank <= 3 ? "bg-gradient-to-r from-yellow-50/50 to-transparent dark:from-yellow-900/10" : ""
                      }`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getRankBadge(driver.rank)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                            {driver.image ? (
                              <img
                                src={driver.image}
                                alt={driver.firstname}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-500 font-semibold">
                                {driver.firstname?.[0]}
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">
                              {driver.firstname} {driver.lastname}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              @{driver.username}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="font-semibold text-gray-900 dark:text-white">
                          {activeTab === "monthly" ? driver.monthlyTrips : driver.totalTrips}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                          <span className="text-gray-700 dark:text-gray-300">
                            {driver.rating?.toFixed(1) || "N/A"}
                          </span>
                        </div>
                      </td>
                      {activeTab === "monthly" && (
                        <td className="px-6 py-4 whitespace-nowrap text-gray-600 dark:text-gray-400">
                          {driver.totalTrips}
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Certificate Modal */}
      <Modal isOpen={isCertificateOpen} onClose={closeCertificateModal} className="max-w-4xl">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Certificate Preview
            </h2>
            <div className="flex gap-2">
              <button
                onClick={downloadCertificate}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download
              </button>
              <button
                onClick={printCertificate}
                className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print
              </button>
            </div>
          </div>

          {/* Certificate */}
          {certificateData && (
            <div 
              ref={certificateRef}
              className="certificate mx-auto"
              style={{
                width: '800px',
                padding: '40px',
                border: '8px double #DAA520',
                background: 'linear-gradient(135deg, #fffef0 0%, #fff8dc 100%)',
                textAlign: 'center',
                position: 'relative',
                fontFamily: "'Times New Roman', serif",
              }}
            >
              {/* Inner border */}
              <div style={{
                position: 'absolute',
                top: '15px',
                left: '15px',
                right: '15px',
                bottom: '15px',
                border: '2px solid #DAA520',
                pointerEvents: 'none',
              }} />

              {/* Content */}
              <div style={{ position: 'relative', zIndex: 1 }}>
                {/* Seal/Medal */}
                <div style={{ fontSize: '60px', marginBottom: '10px' }}>🏆</div>

                {/* Title */}
                <h1 style={{
                  fontSize: '48px',
                  color: '#8B4513',
                  marginBottom: '10px',
                  fontWeight: 'bold',
                  textShadow: '2px 2px 4px rgba(0,0,0,0.1)',
                }}>
                  Certificate of Excellence
                </h1>

                {/* Subtitle */}
                <p style={{
                  fontSize: '24px',
                  color: '#666',
                  marginBottom: '30px',
                  fontStyle: 'italic',
                }}>
                  TricycleMOD Driver Recognition Award
                </p>

                {/* Presented to */}
                <p style={{
                  fontSize: '18px',
                  color: '#444',
                  margin: '20px 0',
                }}>
                  This certificate is proudly presented to
                </p>

                {/* Name */}
                <h2 style={{
                  fontSize: '36px',
                  color: '#2C5282',
                  fontWeight: 'bold',
                  margin: '20px 0',
                  borderBottom: '2px solid #DAA520',
                  display: 'inline-block',
                  padding: '0 20px 10px',
                }}>
                  {certificateData.name}
                </h2>

                {/* Achievement */}
                <p style={{
                  fontSize: '20px',
                  color: '#444',
                  margin: '20px 0',
                  lineHeight: '1.6',
                }}>
                  In recognition of outstanding performance as the
                  <br />
                  <strong style={{ color: '#8B4513' }}>Top Driver</strong> for {certificateData.period}
                </p>

                {/* Trips count */}
                <p style={{
                  fontSize: '28px',
                  color: '#38A169',
                  fontWeight: 'bold',
                  margin: '20px 0',
                }}>
                  🚗 {certificateData.trips} Completed Trips 🚗
                </p>

                {/* Footer with date and signature */}
                <div style={{
                  marginTop: '40px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '0 60px',
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{
                      fontSize: '16px',
                      color: '#333',
                      marginBottom: '5px',
                    }}>
                      {certificateData.date}
                    </p>
                    <p style={{
                      fontSize: '14px',
                      color: '#666',
                      borderTop: '1px solid #999',
                      paddingTop: '5px',
                    }}>
                      Date Issued
                    </p>
                  </div>

                  <div style={{ textAlign: 'center' }}>
                    <p style={{
                      fontSize: '16px',
                      color: '#333',
                      marginBottom: '5px',
                      fontStyle: 'italic',
                    }}>
                      TricycleMOD Admin
                    </p>
                    <p style={{
                      fontSize: '14px',
                      color: '#666',
                      borderTop: '1px solid #999',
                      paddingTop: '5px',
                    }}>
                      Authorized Signature
                    </p>
                  </div>
                </div>

                {/* Bottom decorative elements */}
                <div style={{
                  marginTop: '20px',
                  fontSize: '14px',
                  color: '#888',
                }}>
                  Certificate ID: TMOD-{Date.now().toString(36).toUpperCase()}
                </div>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
};

export default Leaderboard;
