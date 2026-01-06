/**
 * MaintenanceHistoryModal.jsx - Maintenance History Modal for Operators
 * 
 * Features:
 * - View complete maintenance history for a tricycle
 * - Export to CSV functionality
 * - Export to PDF functionality
 * - Filter and sort records
 * - Print-friendly view
 */

import { useState, useMemo, useRef } from 'react';
import { Modal } from './ui/modal';

// Part definitions for display
const PART_INFO = {
  tire_pressure: { name: 'Tire Pressure', category: 'Safety' },
  chain: { name: 'Chain', category: 'Drivetrain' },
  battery_water: { name: 'Battery Water', category: 'Electrical' },
  air_filter_clean: { name: 'Air Filter (Clean)', category: 'Engine' },
  brake_check: { name: 'Brake System', category: 'Safety' },
  cables: { name: 'Control Cables', category: 'Controls' },
  engine_oil: { name: 'Engine Oil', category: 'Engine' },
  spark_plug: { name: 'Spark Plug', category: 'Ignition' },
  carburetor: { name: 'Carburetor', category: 'Fuel System' },
  chain_sprockets: { name: 'Chain & Sprockets', category: 'Drivetrain' },
  oil_filter: { name: 'Oil Filter', category: 'Engine' },
  air_filter_replace: { name: 'Air Filter (Replace)', category: 'Engine' },
  valve_clearance: { name: 'Valve Clearance', category: 'Engine' },
  battery_test: { name: 'Battery Test', category: 'Electrical' },
  brake_fluid_flush: { name: 'Brake Fluid', category: 'Safety' },
  clutch_plates: { name: 'Clutch Plates', category: 'Drivetrain' },
  suspension: { name: 'Suspension', category: 'Chassis' },
  engine_overhaul: { name: 'Engine Overhaul', category: 'Engine' },
  transmission_oil: { name: 'Transmission Oil', category: 'Drivetrain' },
  wiring_harness: { name: 'Wiring Harness', category: 'Electrical' },
};

// Category colors
const CATEGORY_COLORS = {
  Safety: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400' },
  Engine: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-400' },
  Drivetrain: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400' },
  Electrical: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400' },
  'Fuel System': { bg: 'bg-teal-100 dark:bg-teal-900/30', text: 'text-teal-700 dark:text-teal-400' },
  Ignition: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400' },
  Controls: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-400' },
  Chassis: { bg: 'bg-pink-100 dark:bg-pink-900/30', text: 'text-pink-700 dark:text-pink-400' },
  Other: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-700 dark:text-gray-400' },
};

// Format date for display
const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const formatDateTime = (dateStr) => {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const MaintenanceHistoryModal = ({ isOpen, onClose, tricycle }) => {
  const [sortBy, setSortBy] = useState('newest');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [exporting, setExporting] = useState(false);
  const printRef = useRef(null);

  // Get maintenance history from tricycle
  const maintenanceHistory = tricycle?.maintenanceHistory || [];

  // Calculate statistics
  const stats = useMemo(() => {
    const totalServices = maintenanceHistory.length;
    const categories = {};
    let lastServiceDate = null;

    maintenanceHistory.forEach(record => {
      const partInfo = PART_INFO[record.itemKey];
      const cat = partInfo?.category || 'Other';
      categories[cat] = (categories[cat] || 0) + 1;
      
      const recordDate = record.completedAt || record.date;
      if (recordDate && (!lastServiceDate || new Date(recordDate) > new Date(lastServiceDate))) {
        lastServiceDate = recordDate;
      }
    });

    const mostServicedCategory = Object.entries(categories)
      .sort((a, b) => b[1] - a[1])[0];

    return {
      totalServices,
      lastServiceDate,
      mostServicedCategory: mostServicedCategory ? mostServicedCategory[0] : 'N/A',
      categoryCounts: categories,
    };
  }, [maintenanceHistory]);

  // Filter and sort history
  const filteredHistory = useMemo(() => {
    let result = [...maintenanceHistory];

    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(record => {
        const partInfo = PART_INFO[record.itemKey];
        const partName = partInfo?.name?.toLowerCase() || record.itemKey?.toLowerCase() || '';
        const category = partInfo?.category?.toLowerCase() || '';
        const notes = record.notes?.toLowerCase() || '';
        return partName.includes(query) || category.includes(query) || notes.includes(query);
      });
    }

    // Apply date filter
    if (dateFilter !== 'all') {
      const now = new Date();
      let cutoffDate;
      
      if (dateFilter === '30') {
        cutoffDate = new Date(now.setDate(now.getDate() - 30));
      } else if (dateFilter === '90') {
        cutoffDate = new Date(now.setDate(now.getDate() - 90));
      } else if (dateFilter === 'year') {
        cutoffDate = new Date(now.getFullYear(), 0, 1);
      }
      
      if (cutoffDate) {
        result = result.filter(record => {
          const recordDate = record.completedAt || record.date;
          return recordDate && new Date(recordDate) >= cutoffDate;
        });
      }
    }

    // Apply category filter
    if (categoryFilter !== 'all') {
      result = result.filter(record => {
        const partInfo = PART_INFO[record.itemKey];
        return partInfo?.category === categoryFilter;
      });
    }

    // Apply sort
    result.sort((a, b) => {
      const dateA = new Date(a.completedAt || a.date || 0);
      const dateB = new Date(b.completedAt || b.date || 0);
      const kmA = a.lastServiceKm || a.km || 0;
      const kmB = b.lastServiceKm || b.km || 0;

      if (sortBy === 'newest') return dateB - dateA;
      if (sortBy === 'oldest') return dateA - dateB;
      if (sortBy === 'km_high') return kmB - kmA;
      if (sortBy === 'km_low') return kmA - kmB;
      return 0;
    });

    return result;
  }, [maintenanceHistory, sortBy, categoryFilter, dateFilter, searchQuery]);

  // Generate CSV content
  const generateCSV = () => {
    const headers = ['Date', 'Part', 'Category', 'Odometer (km)', 'Notes'];
    const rows = filteredHistory.map(record => {
      const partInfo = PART_INFO[record.itemKey] || { name: record.itemKey, category: 'Other' };
      return [
        formatDateTime(record.completedAt || record.date),
        partInfo.name,
        partInfo.category,
        record.lastServiceKm || record.km || 0,
        `"${(record.notes || '').replace(/"/g, '""')}"`,
      ].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  };

  // Export to CSV
  const handleExportCSV = async () => {
    try {
      setExporting(true);
      const csvContent = generateCSV();
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `maintenance_history_${tricycle?.plateNumber || 'vehicle'}_${Date.now()}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export error:', error);
    } finally {
      setExporting(false);
    }
  };

  // Generate and download PDF using print
  const handleExportPDF = () => {
    const printContent = document.getElementById('maintenance-print-content');
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Maintenance History - ${tricycle?.plateNumber || 'Vehicle'}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { font-size: 24px; margin-bottom: 10px; }
          h2 { font-size: 18px; margin: 20px 0 10px; border-bottom: 2px solid #333; padding-bottom: 5px; }
          .header-info { margin-bottom: 20px; color: #666; }
          .stats-grid { display: flex; gap: 20px; margin-bottom: 20px; }
          .stat-box { padding: 10px; border: 1px solid #ddd; border-radius: 4px; text-align: center; }
          .stat-value { font-size: 24px; font-weight: bold; }
          .stat-label { font-size: 12px; color: #666; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f5f5f5; font-weight: bold; }
          tr:nth-child(even) { background-color: #fafafa; }
          .category { font-size: 11px; padding: 2px 6px; border-radius: 10px; background: #eee; }
          .footer { margin-top: 30px; padding-top: 10px; border-top: 1px solid #ddd; font-size: 12px; color: #666; text-align: center; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <h1>Maintenance Service History</h1>
        <div class="header-info">
          <p><strong>Vehicle:</strong> ${tricycle?.plateNumber || 'Unknown'}</p>
          <p><strong>Model:</strong> ${tricycle?.model || 'N/A'}</p>
          <p><strong>Generated:</strong> ${formatDateTime(new Date().toISOString())}</p>
          <p><strong>Total Records:</strong> ${filteredHistory.length}</p>
        </div>

        <h2>Summary Statistics</h2>
        <div class="stats-grid">
          <div class="stat-box">
            <div class="stat-value">${stats.totalServices}</div>
            <div class="stat-label">Total Services</div>
          </div>
          <div class="stat-box">
            <div class="stat-value">${stats.lastServiceDate ? formatDate(stats.lastServiceDate) : 'N/A'}</div>
            <div class="stat-label">Last Service</div>
          </div>
          <div class="stat-box">
            <div class="stat-value">${stats.mostServicedCategory}</div>
            <div class="stat-label">Most Serviced</div>
          </div>
        </div>

        <h2>Service Records</h2>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Date</th>
              <th>Part</th>
              <th>Category</th>
              <th>Odometer (km)</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            ${filteredHistory.map((record, idx) => {
              const partInfo = PART_INFO[record.itemKey] || { name: record.itemKey, category: 'Other' };
              return `
                <tr>
                  <td>${idx + 1}</td>
                  <td>${formatDateTime(record.completedAt || record.date)}</td>
                  <td>${partInfo.name}</td>
                  <td><span class="category">${partInfo.category}</span></td>
                  <td>${(record.lastServiceKm || record.km || 0).toLocaleString()}</td>
                  <td>${record.notes || '-'}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <div class="footer">
          <p>Generated by TricycleMOD Maintenance System</p>
        </div>
      </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    
    setTimeout(() => {
      printWindow.print();
      // printWindow.close(); // Uncomment to auto-close after print
    }, 500);
  };

  // Get unique categories for filter
  const categories = [...new Set(Object.values(PART_INFO).map(p => p.category))];

  if (!tricycle) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-[900px] p-0">
      <div className="flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                <svg className="h-5 w-5 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Maintenance History
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {tricycle.plateNumber} • {maintenanceHistory.length} service records
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportCSV}
                disabled={exporting || filteredHistory.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                CSV
              </button>
              <button
                onClick={handleExportPDF}
                disabled={filteredHistory.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print/PDF
              </button>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-brand-600 dark:text-brand-400">{stats.totalServices}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Total Services</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold text-gray-800 dark:text-white">
                {stats.lastServiceDate ? formatDate(stats.lastServiceDate) : 'N/A'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Last Service</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold text-gray-800 dark:text-white">{stats.mostServicedCategory}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Most Serviced</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <input
                type="text"
                placeholder="Search parts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-9 pl-9 pr-4 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-white placeholder:text-gray-400 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500/10"
              />
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            {/* Date Filter */}
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="h-9 px-3 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-white focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500/10"
            >
              <option value="all">All Time</option>
              <option value="30">Last 30 Days</option>
              <option value="90">Last 90 Days</option>
              <option value="year">This Year</option>
            </select>

            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-9 px-3 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-white focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500/10"
            >
              <option value="all">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="h-9 px-3 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-white focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-500/10"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="km_high">Highest KM</option>
              <option value="km_low">Lowest KM</option>
            </select>

            {/* Clear */}
            {(searchQuery || dateFilter !== 'all' || categoryFilter !== 'all') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setDateFilter('all');
                  setCategoryFilter('all');
                }}
                className="h-9 px-3 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Records List */}
        <div className="flex-1 overflow-y-auto p-4" id="maintenance-print-content" ref={printRef}>
          {filteredHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-500 dark:text-gray-400">
              <svg className="h-16 w-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-lg font-medium">No Records Found</p>
              <p className="text-sm">
                {searchQuery || categoryFilter !== 'all' || dateFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'No maintenance history recorded yet'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredHistory.map((record, idx) => {
                const partInfo = PART_INFO[record.itemKey] || { name: record.itemKey, category: 'Other' };
                const categoryColors = CATEGORY_COLORS[partInfo.category] || CATEGORY_COLORS.Other;
                
                return (
                  <div
                    key={`${record.itemKey}-${record.completedAt || record.date}-${idx}`}
                    className="flex items-center gap-4 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    {/* Index */}
                    <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs font-medium text-gray-600 dark:text-gray-400">
                      {idx + 1}
                    </div>

                    {/* Main Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-sm font-semibold text-gray-800 dark:text-white truncate">
                          {partInfo.name}
                        </h4>
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${categoryColors.bg} ${categoryColors.text}`}>
                          {partInfo.category}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1">
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {formatDate(record.completedAt || record.date)}
                        </span>
                        <span className="flex items-center gap-1">
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          {(record.lastServiceKm || record.km || 0).toLocaleString()} km
                        </span>
                        {record.notes && (
                          <span className="truncate text-gray-400 dark:text-gray-500 italic" title={record.notes}>
                            {record.notes}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Showing {filteredHistory.length} of {maintenanceHistory.length} records
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default MaintenanceHistoryModal;
