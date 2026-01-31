import { useState, useEffect } from "react";
import Chart from "react-apexcharts";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Helper to get auth headers
const getAuthHeaders = () => {
  const token = localStorage.getItem('adminToken');
  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
};

/**
 * Sentiment Quadrant Scatter Plot
 * 
 * Visualizes complaint sentiment analysis data in a quadrant format:
 * - X-axis: Sentiment Score (Negative to Positive)
 * - Y-axis: Confidence/Severity Score
 * 
 * Quadrants:
 * - Top-Right: High Confidence Positive (Green)
 * - Top-Left: High Confidence Negative (Red) - Priority attention
 * - Bottom-Right: Low Confidence Positive (Light Green)
 * - Bottom-Left: Low Confidence Negative (Orange)
 */

const InfoIcon = () => (
  <svg className="size-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-help" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

export default function SentimentQuadrantChart() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [quadrantData, setQuadrantData] = useState(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');

  const categoryLabels = {
    all: "All Categories",
    rude_behavior: "Rude Behavior",
    overcharging: "Overcharging",
    unsafe_driving: "Unsafe Driving",
    route_deviation: "Route Deviation",
    vehicle_condition: "Vehicle Condition",
    refusal_of_service: "Refusal of Service",
    harassment: "Harassment",
    discrimination: "Discrimination",
    intoxicated_driving: "Intoxicated Driving",
    other: "Other",
  };

  useEffect(() => {
    fetchQuadrantData();
  }, [selectedCategory]);

  const fetchQuadrantData = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = selectedCategory !== 'all' ? `?category=${selectedCategory}` : '';
      const response = await axios.get(
        `${API_URL}/dashboard/sentiment-quadrant${params}`,
        getAuthHeaders()
      );
      if (response.data.success) {
        setQuadrantData(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching sentiment quadrant data:', err);
      setError(err.response?.data?.message || 'Failed to load sentiment data');
    } finally {
      setLoading(false);
    }
  };

  // Transform data for scatter plot
  const getSeriesData = () => {
    if (!quadrantData?.complaints) return [];

    // Group complaints by urgency for different colors
    const criticalData = [];
    const highData = [];
    const mediumData = [];
    const lowData = [];
    const normalData = [];

    quadrantData.complaints.forEach((complaint) => {
      const dataPoint = {
        x: complaint.sentimentScore, // -1 to 1 (negative to positive)
        y: complaint.confidence * 100, // 0-100%
        id: complaint._id,
        category: complaint.category,
        urgency: complaint.urgency,
        severity: complaint.severityScore,
        status: complaint.status,
        date: complaint.createdAt,
        // New: Include detected indicator words
        negativeWords: complaint.taglishIndicators?.negativeWords || [],
        positiveWords: complaint.taglishIndicators?.positiveWords || [],
        isTaglish: complaint.taglishIndicators?.isTaglish || false,
        descriptionPreview: complaint.descriptionPreview || '',
      };

      switch (complaint.urgency) {
        case 'critical':
          criticalData.push(dataPoint);
          break;
        case 'high':
          highData.push(dataPoint);
          break;
        case 'medium':
          mediumData.push(dataPoint);
          break;
        case 'low':
          lowData.push(dataPoint);
          break;
        default:
          normalData.push(dataPoint);
      }
    });

    return [
      { name: '🚨 Critical', data: criticalData },
      { name: '⚠️ High', data: highData },
      { name: '📋 Medium', data: mediumData },
      { name: '📝 Low', data: lowData },
      { name: '📄 Normal', data: normalData },
    ].filter(series => series.data.length > 0);
  };

  const chartOptions = {
    chart: {
      type: 'scatter',
      height: 400,
      fontFamily: 'Outfit, sans-serif',
      toolbar: {
        show: true,
        tools: {
          download: true,
          selection: true,
          zoom: true,
          zoomin: true,
          zoomout: true,
          pan: true,
          reset: true,
        },
      },
      zoom: {
        enabled: true,
        type: 'xy',
      },
      animations: {
        enabled: true,
        easing: 'easeinout',
        speed: 800,
      },
    },
    colors: ['#EF4444', '#F97316', '#EAB308', '#22C55E', '#6B7280'], // Red, Orange, Yellow, Green, Gray
    markers: {
      size: 10,
      strokeWidth: 2,
      strokeColors: '#fff',
      hover: {
        size: 14,
        sizeOffset: 3,
      },
    },
    xaxis: {
      title: {
        text: 'Sentiment Polarity',
        style: {
          fontSize: '12px',
          fontWeight: 600,
        },
      },
      min: -1,
      max: 1,
      tickAmount: 10,
      labels: {
        formatter: (val) => {
          if (val === -1) return 'Negative';
          if (val === 0) return 'Neutral';
          if (val === 1) return 'Positive';
          return val.toFixed(1);
        },
        style: {
          fontSize: '10px',
        },
      },
      axisBorder: {
        show: true,
        color: '#e5e7eb',
      },
      crosshairs: {
        show: true,
        stroke: {
          color: '#6366f1',
          width: 1,
          dashArray: 3,
        },
      },
    },
    yaxis: {
      title: {
        text: 'Confidence Level (%)',
        style: {
          fontSize: '12px',
          fontWeight: 600,
        },
      },
      min: 0,
      max: 100,
      tickAmount: 5,
      labels: {
        formatter: (val) => `${Math.round(val)}%`,
        style: {
          fontSize: '10px',
        },
      },
    },
    grid: {
      borderColor: '#e5e7eb',
      strokeDashArray: 4,
      xaxis: {
        lines: {
          show: true,
        },
      },
      yaxis: {
        lines: {
          show: true,
        },
      },
    },
    annotations: {
      // Vertical line at neutral (0)
      xaxis: [
        {
          x: 0,
          strokeDashArray: 0,
          borderColor: '#9CA3AF',
          borderWidth: 2,
          label: {
            borderColor: '#9CA3AF',
            style: {
              color: '#fff',
              background: '#9CA3AF',
              fontSize: '10px',
            },
            text: 'Neutral',
            position: 'top',
          },
        },
      ],
      // Horizontal line at 50% confidence
      yaxis: [
        {
          y: 50,
          strokeDashArray: 5,
          borderColor: '#D1D5DB',
          borderWidth: 1,
          label: {
            borderColor: '#D1D5DB',
            style: {
              color: '#374151',
              background: '#F3F4F6',
              fontSize: '10px',
            },
            text: 'Med Confidence',
            position: 'left',
          },
        },
      ],
      // Quadrant labels
      points: [
        {
          x: -0.7,
          y: 85,
          marker: { size: 0 },
          label: {
            borderColor: 'transparent',
            style: {
              background: 'transparent',
              color: '#EF4444',
              fontSize: '11px',
              fontWeight: 600,
            },
            text: '⚠️ High Priority',
            offsetY: 0,
          },
        },
        {
          x: 0.7,
          y: 85,
          marker: { size: 0 },
          label: {
            borderColor: 'transparent',
            style: {
              background: 'transparent',
              color: '#22C55E',
              fontSize: '11px',
              fontWeight: 600,
            },
            text: '✓ Positive Feedback',
            offsetY: 0,
          },
        },
        {
          x: -0.7,
          y: 15,
          marker: { size: 0 },
          label: {
            borderColor: 'transparent',
            style: {
              background: 'transparent',
              color: '#F97316',
              fontSize: '11px',
              fontWeight: 600,
            },
            text: '🔍 Review Needed',
            offsetY: 0,
          },
        },
        {
          x: 0.7,
          y: 15,
          marker: { size: 0 },
          label: {
            borderColor: 'transparent',
            style: {
              background: 'transparent',
              color: '#6B7280',
              fontSize: '11px',
              fontWeight: 600,
            },
            text: '📋 Low Priority',
            offsetY: 0,
          },
        },
      ],
    },
    tooltip: {
      enabled: true,
      shared: false,
      intersect: true,
      custom: function({ series, seriesIndex, dataPointIndex, w }) {
        const data = w.config.series[seriesIndex].data[dataPointIndex];
        if (!data) return '';
        
        const sentimentText = data.x < -0.3 ? 'Negative' : data.x > 0.3 ? 'Positive' : 'Neutral';
        const confidenceText = data.y >= 70 ? 'High' : data.y >= 40 ? 'Medium' : 'Low';
        
        // Build detected words section
        const hasNegativeWords = data.negativeWords && data.negativeWords.length > 0;
        const hasPositiveWords = data.positiveWords && data.positiveWords.length > 0;
        const hasDetectedWords = hasNegativeWords || hasPositiveWords;
        
        let detectedWordsHtml = '';
        if (hasDetectedWords) {
          detectedWordsHtml = `
            <div class="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
              <p class="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">🔍 Detected Keywords:</p>
              ${hasNegativeWords ? `
                <div class="flex flex-wrap gap-1 mb-1">
                  ${data.negativeWords.slice(0, 5).map(word => `<span class="px-1.5 py-0.5 text-xs bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 rounded">${word}</span>`).join('')}
                  ${data.negativeWords.length > 5 ? `<span class="text-xs text-gray-400">+${data.negativeWords.length - 5} more</span>` : ''}
                </div>
              ` : ''}
              ${hasPositiveWords ? `
                <div class="flex flex-wrap gap-1">
                  ${data.positiveWords.slice(0, 5).map(word => `<span class="px-1.5 py-0.5 text-xs bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 rounded">${word}</span>`).join('')}
                  ${data.positiveWords.length > 5 ? `<span class="text-xs text-gray-400">+${data.positiveWords.length - 5} more</span>` : ''}
                </div>
              ` : ''}
            </div>
          `;
        }
        
        // Description preview
        let descriptionHtml = '';
        if (data.descriptionPreview) {
          descriptionHtml = `
            <div class="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
              <p class="text-xs text-gray-500 dark:text-gray-400 italic">"${data.descriptionPreview}"</p>
            </div>
          `;
        }
        
        return `
          <div class="p-3 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 min-w-[250px] max-w-[320px]">
            <div class="font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
              <span class="text-lg">${data.urgency === 'critical' ? '🚨' : data.urgency === 'high' ? '⚠️' : data.urgency === 'medium' ? '📋' : '📝'}</span>
              ${categoryLabels[data.category] || data.category}
              ${data.isTaglish ? '<span class="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 px-1.5 py-0.5 rounded">🇵🇭 Taglish</span>' : ''}
            </div>
            <div class="space-y-1 text-sm">
              <div class="flex justify-between">
                <span class="text-gray-500 dark:text-gray-400">Sentiment:</span>
                <span class="font-medium ${data.x < -0.3 ? 'text-red-600' : data.x > 0.3 ? 'text-green-600' : 'text-gray-600'}">${sentimentText} (${data.x.toFixed(2)})</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500 dark:text-gray-400">Confidence:</span>
                <span class="font-medium">${confidenceText} (${data.y.toFixed(0)}%)</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500 dark:text-gray-400">Severity:</span>
                <span class="font-medium">${data.severity?.toFixed(1) || 'N/A'}/5</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500 dark:text-gray-400">Status:</span>
                <span class="font-medium capitalize">${data.status?.replace('_', ' ') || 'N/A'}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-500 dark:text-gray-400">Urgency:</span>
                <span class="font-medium capitalize ${
                  data.urgency === 'critical' ? 'text-red-600' : 
                  data.urgency === 'high' ? 'text-orange-600' : 
                  data.urgency === 'medium' ? 'text-yellow-600' : 'text-green-600'
                }">${data.urgency || 'N/A'}</span>
              </div>
            </div>
            ${detectedWordsHtml}
            ${descriptionHtml}
          </div>
        `;
      },
    },
    legend: {
      show: true,
      position: 'top',
      horizontalAlign: 'center',
      floating: false,
      fontSize: '12px',
      fontWeight: 500,
      markers: {
        width: 10,
        height: 10,
        radius: 5,
      },
      itemMargin: {
        horizontal: 10,
        vertical: 5,
      },
    },
    responsive: [
      {
        breakpoint: 768,
        options: {
          chart: {
            height: 350,
          },
          legend: {
            position: 'bottom',
          },
        },
      },
    ],
  };

  // Update chart options for dark mode
  const getDarkModeOptions = () => ({
    ...chartOptions,
    chart: {
      ...chartOptions.chart,
      foreColor: '#9CA3AF',
    },
    grid: {
      ...chartOptions.grid,
      borderColor: '#374151',
    },
    xaxis: {
      ...chartOptions.xaxis,
      axisBorder: {
        ...chartOptions.xaxis.axisBorder,
        color: '#374151',
      },
    },
  });

  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4 dark:bg-gray-700"></div>
          <div className="h-[400px] bg-gray-200 rounded dark:bg-gray-700"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="text-center py-12">
          <div className="text-red-500 text-lg mb-2">⚠️ Error Loading Data</div>
          <p className="text-gray-500 dark:text-gray-400">{error}</p>
          <button 
            onClick={fetchQuadrantData}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const series = getSeriesData();

  return (
    <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              📊 Sentiment Analysis Quadrant
            </h3>
            <div 
              className="relative"
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
            >
              <InfoIcon />
              {showTooltip && (
                <div className="absolute left-0 top-6 z-50 w-72 p-3 bg-gray-800 text-white text-xs rounded-lg shadow-lg dark:bg-gray-700 text-left">
                  <p className="font-semibold mb-2">How to Read This Chart</p>
                  <ul className="space-y-1.5">
                    <li><span className="text-red-400">Top-Left:</span> High confidence negative complaints - Priority attention needed</li>
                    <li><span className="text-green-400">Top-Right:</span> High confidence positive feedback</li>
                    <li><span className="text-orange-400">Bottom-Left:</span> Low confidence negative - Review needed</li>
                    <li><span className="text-gray-400">Bottom-Right:</span> Low confidence positive - Low priority</li>
                  </ul>
                  <p className="mt-2 text-gray-300">Click on points to view complaint details. Use filters to narrow down by category.</p>
                  <div className="absolute -top-1 left-4 w-2 h-2 bg-gray-800 dark:bg-gray-700 rotate-45"></div>
                </div>
              )}
            </div>
          </div>
          
          {/* Category Filter */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-500 dark:text-gray-400">Filter:</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {Object.entries(categoryLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>
        
        {/* Quick Stats */}
        {quadrantData?.summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-red-600 dark:text-red-400">
                {quadrantData.summary.critical || 0}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">🚨 Critical</p>
            </div>
            <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-orange-600 dark:text-orange-400">
                {quadrantData.summary.high || 0}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">⚠️ High</p>
            </div>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-yellow-600 dark:text-yellow-400">
                {quadrantData.summary.medium || 0}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">📋 Medium</p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-green-600 dark:text-green-400">
                {(quadrantData.summary.low || 0) + (quadrantData.summary.normal || 0)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">📝 Low/Normal</p>
            </div>
          </div>
        )}
      </div>
      
      {/* Chart */}
      <div className="p-6">
        {series.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[400px] text-gray-500 dark:text-gray-400">
            <svg className="w-16 h-16 mb-4 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <p className="text-lg font-medium">No Sentiment Data Available</p>
            <p className="text-sm mt-1">Complaints with sentiment analysis will appear here</p>
          </div>
        ) : (
          <Chart 
            options={chartOptions} 
            series={series} 
            type="scatter" 
            height={400} 
          />
        )}
      </div>
      
      {/* Legend Explanation */}
      <div className="px-6 pb-6">
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Quadrant Interpretation Guide
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-gray-600 dark:text-gray-400">
            <div className="flex items-start gap-2">
              <span className="text-red-500 text-lg">●</span>
              <div>
                <span className="font-medium text-gray-700 dark:text-gray-300">High Priority (Top-Left):</span>
                <p>Negative sentiment with high confidence - requires immediate attention</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-green-500 text-lg">●</span>
              <div>
                <span className="font-medium text-gray-700 dark:text-gray-300">Positive Feedback (Top-Right):</span>
                <p>Positive sentiment with high confidence - good indicators</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-orange-500 text-lg">●</span>
              <div>
                <span className="font-medium text-gray-700 dark:text-gray-300">Review Needed (Bottom-Left):</span>
                <p>Negative sentiment with low confidence - needs manual review</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-gray-500 text-lg">●</span>
              <div>
                <span className="font-medium text-gray-700 dark:text-gray-300">Low Priority (Bottom-Right):</span>
                <p>Positive/neutral with low confidence - standard processing</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
