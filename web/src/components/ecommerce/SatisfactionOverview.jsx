import { useState } from "react";

// Info Icon for Tooltips
const InfoIcon = () => (
  <svg className="size-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-help" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

// Star Icon Component
const StarIcon = ({ filled, half }) => (
  <svg 
    className={`w-5 h-5 ${filled ? 'text-yellow-400' : half ? 'text-yellow-400' : 'text-gray-300 dark:text-gray-600'}`} 
    fill={filled || half ? 'currentColor' : 'none'}
    viewBox="0 0 24 24" 
    stroke="currentColor"
  >
    {half ? (
      <>
        <defs>
          <linearGradient id="halfGrad">
            <stop offset="50%" stopColor="currentColor" />
            <stop offset="50%" stopColor="transparent" />
          </linearGradient>
        </defs>
        <path 
          fill="url(#halfGrad)"
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth={2} 
          d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" 
        />
      </>
    ) : (
      <path 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        strokeWidth={2} 
        d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" 
      />
    )}
  </svg>
);

// Sentiment Icon Component
const SentimentIcon = ({ type }) => {
  const icons = {
    positive: (
      <svg className="w-6 h-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    negative: (
      <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    neutral: (
      <svg className="w-6 h-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  };
  return icons[type] || icons.neutral;
};

// Rating Stars Display
const RatingStars = ({ rating }) => {
  const fullStars = Math.floor(rating);
  const hasHalf = rating % 1 >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalf ? 1 : 0);
  
  return (
    <div className="flex items-center gap-0.5">
      {[...Array(fullStars)].map((_, i) => (
        <StarIcon key={`full-${i}`} filled />
      ))}
      {hasHalf && <StarIcon key="half" half />}
      {[...Array(emptyStars)].map((_, i) => (
        <StarIcon key={`empty-${i}`} />
      ))}
    </div>
  );
};

// Progress Bar Component
const ProgressBar = ({ value, max, color = "bg-blue-500" }) => {
  const percentage = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
      <div 
        className={`h-2 rounded-full ${color}`} 
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
};

export default function SatisfactionOverview({ stats, loading }) {
  const [activeTab, setActiveTab] = useState('satisfaction'); // 'satisfaction' or 'sentiment'
  const [showTooltip, setShowTooltip] = useState(null);
  
  const satisfaction = stats?.satisfaction || {
    totalReviews: 0,
    avgRating: 0,
    satisfactionRate: 0,
    distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
  };
  
  const sentiment = stats?.sentiment || {
    total: 0,
    breakdown: { positive: 0, negative: 0, neutral: 0 },
  };
  
  const complaints = stats?.complaints || {
    total: 0,
    byStatus: {},
    byUrgency: {},
  };

  const maxDistribution = Math.max(...Object.values(satisfaction.distribution), 1);
  
  const getSatisfactionColor = (rate) => {
    if (rate >= 80) return 'text-green-500';
    if (rate >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getUrgencyColor = (urgency) => {
    const colors = {
      critical: 'bg-red-500',
      high: 'bg-orange-500',
      normal: 'bg-yellow-500',
      medium: 'bg-blue-500',
      low: 'bg-green-500',
    };
    return colors[urgency] || 'bg-gray-500';
  };

  const formatCategory = (category) => {
    return category?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Unknown';
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4 dark:bg-gray-700"></div>
          <div className="h-32 bg-gray-200 rounded dark:bg-gray-700"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
      {/* Tab Headers */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('satisfaction')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
            activeTab === 'satisfaction'
              ? 'text-blue-600 border-b-2 border-blue-600 dark:text-blue-400'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
        >
          Customer Satisfaction
          <div 
            className="relative"
            onMouseEnter={(e) => { e.stopPropagation(); setShowTooltip('satisfaction'); }}
            onMouseLeave={() => setShowTooltip(null)}
            onClick={(e) => e.stopPropagation()}
          >
            <InfoIcon />
            {showTooltip === 'satisfaction' && (
              <div className="absolute left-1/2 -translate-x-1/2 top-6 z-50 w-64 p-3 bg-gray-800 text-white text-xs rounded-lg shadow-lg dark:bg-gray-700 text-left">
                <p className="font-semibold mb-1">Customer Satisfaction Data</p>
                <p>Aggregated from passenger reviews after completed trips.</p>
                <p className="mt-2 text-gray-300"><span className="text-yellow-400">Avg Rating:</span> Mean of all star ratings (1-5)</p>
                <p className="text-gray-300"><span className="text-green-400">Satisfaction Rate:</span> % of 4-5 star reviews</p>
                <p className="mt-1 text-gray-300">Source: Review collection</p>
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-800 dark:bg-gray-700 rotate-45"></div>
              </div>
            )}
          </div>
        </button>
        <button
          onClick={() => setActiveTab('sentiment')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
            activeTab === 'sentiment'
              ? 'text-blue-600 border-b-2 border-blue-600 dark:text-blue-400'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
        >
          Sentiment Analysis
          <div 
            className="relative"
            onMouseEnter={(e) => { e.stopPropagation(); setShowTooltip('sentiment'); }}
            onMouseLeave={() => setShowTooltip(null)}
            onClick={(e) => e.stopPropagation()}
          >
            <InfoIcon />
            {showTooltip === 'sentiment' && (
              <div className="absolute right-0 top-6 z-50 w-64 p-3 bg-gray-800 text-white text-xs rounded-lg shadow-lg dark:bg-gray-700 text-left">
                <p className="font-semibold mb-1">Sentiment Analysis Data</p>
                <p>AI-powered analysis of complaint text to determine emotional tone.</p>
                <p className="mt-2 text-gray-300"><span className="text-green-400">Positive:</span> Constructive feedback</p>
                <p className="text-gray-300"><span className="text-gray-400">Neutral:</span> Factual reports</p>
                <p className="text-gray-300"><span className="text-red-400">Negative:</span> Critical complaints</p>
                <p className="mt-1 text-gray-300">Source: Complaint collection</p>
                <div className="absolute -top-1 right-4 w-2 h-2 bg-gray-800 dark:bg-gray-700 rotate-45"></div>
              </div>
            )}
          </div>
        </button>
      </div>

      <div className="p-6">
        {activeTab === 'satisfaction' ? (
          /* Satisfaction Tab */
          <div className="space-y-6">
            {/* Main Stats */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Average Rating</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-3xl font-bold text-gray-800 dark:text-white">
                    {satisfaction.avgRating.toFixed(1)}
                  </span>
                  <RatingStars rating={satisfaction.avgRating} />
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Based on {satisfaction.totalReviews} reviews
                </p>
              </div>
              
              <div className="text-right">
                <p className="text-sm text-gray-500 dark:text-gray-400">Satisfaction Rate</p>
                <p className={`text-3xl font-bold ${getSatisfactionColor(satisfaction.satisfactionRate)}`}>
                  {satisfaction.satisfactionRate}%
                </p>
                <p className="text-xs text-gray-400 mt-1">4-5 star ratings</p>
              </div>
            </div>

            {/* Rating Distribution */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Rating Distribution</p>
              {[5, 4, 3, 2, 1].map((star) => (
                <div key={star} className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 w-3">{star}</span>
                  <StarIcon filled />
                  <div className="flex-1">
                    <ProgressBar 
                      value={satisfaction.distribution[star]} 
                      max={maxDistribution}
                      color={star >= 4 ? 'bg-green-500' : star === 3 ? 'bg-yellow-500' : 'bg-red-500'}
                    />
                  </div>
                  <span className="text-xs text-gray-500 w-8 text-right">
                    {satisfaction.distribution[star]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Sentiment Analysis Tab */
          <div className="space-y-6">
            {/* Sentiment Overview */}
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
                <SentimentIcon type="positive" />
                <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
                  {sentiment.breakdown.positive}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Positive</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                <SentimentIcon type="neutral" />
                <p className="text-2xl font-bold text-gray-600 dark:text-gray-400 mt-1">
                  {sentiment.breakdown.neutral}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Neutral</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-red-50 dark:bg-red-900/20">
                <SentimentIcon type="negative" />
                <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
                  {sentiment.breakdown.negative}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Negative</p>
              </div>
            </div>

            {/* Complaints Summary */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Complaints Overview
                </p>
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded dark:bg-gray-800 dark:text-gray-400">
                  {complaints.total} Total
                </span>
              </div>
              
              {/* By Status */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                <div className="flex items-center justify-between p-2 bg-yellow-50 rounded dark:bg-yellow-900/20">
                  <span className="text-xs text-gray-600 dark:text-gray-400">Pending</span>
                  <span className="text-sm font-semibold text-yellow-600 dark:text-yellow-400">
                    {complaints.byStatus.pending || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2 bg-blue-50 rounded dark:bg-blue-900/20">
                  <span className="text-xs text-gray-600 dark:text-gray-400">Under Review</span>
                  <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                    {complaints.byStatus.under_review || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2 bg-purple-50 rounded dark:bg-purple-900/20">
                  <span className="text-xs text-gray-600 dark:text-gray-400">Investigating</span>
                  <span className="text-sm font-semibold text-purple-600 dark:text-purple-400">
                    {complaints.byStatus.investigating || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2 bg-green-50 rounded dark:bg-green-900/20">
                  <span className="text-xs text-gray-600 dark:text-gray-400">Resolved</span>
                  <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                    {complaints.byStatus.resolved || 0}
                  </span>
                </div>
              </div>

              {/* Urgency Levels */}
              {Object.keys(complaints.byUrgency || {}).length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 mb-2 dark:text-gray-400">By Urgency Level</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(complaints.byUrgency).map(([urgency, count]) => (
                      <span 
                        key={urgency}
                        className={`text-xs px-2 py-1 rounded text-white ${getUrgencyColor(urgency)}`}
                      >
                        {urgency}: {count}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Top Categories */}
            {complaints.topCategories?.length > 0 && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2 dark:text-gray-300">
                  Top Complaint Categories
                </p>
                <div className="space-y-2">
                  {complaints.topCategories.slice(0, 3).map((cat, idx) => (
                    <div key={cat._id} className="flex items-center justify-between">
                      <span className="text-xs text-gray-600 dark:text-gray-400">
                        {idx + 1}. {formatCategory(cat._id)}
                      </span>
                      <span className="text-xs font-medium text-gray-800 dark:text-gray-200">
                        {cat.count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {sentiment.total === 0 && complaints.total === 0 && (
              <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                <p className="text-sm">No sentiment data available yet</p>
                <p className="text-xs mt-1">Sentiment analysis runs on filed complaints</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
