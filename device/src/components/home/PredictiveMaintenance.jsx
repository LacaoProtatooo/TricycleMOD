/**
 * PredictiveMaintenance.jsx - AI-Powered Maintenance Predictions
 * 
 * Features:
 * - Wear pattern analysis based on historical data
 * - Personalized maintenance intervals based on driving patterns
 * - Smart predictions using regression analysis
 * - Anomaly detection for abnormal wear rates
 * - Health score calculation
 */

import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Circle, Path, G, Defs, LinearGradient, Stop, Text as SvgText } from 'react-native-svg';
import { colors, spacing } from '../common/theme';

const { width: screenWidth } = Dimensions.get('window');

// Storage keys
const MAINTENANCE_HISTORY_KEY = 'maintenance_history_v2';
const WEAR_PATTERNS_KEY = 'wear_patterns_v1';
const KM_KEY = 'vehicle_current_km_v1';

// Default maintenance schedule with expected intervals
const MAINTENANCE_ITEMS = {
  tire_pressure: { name: 'Tire Pressure', interval: 500, category: 'safety', criticalThreshold: 0.9 },
  chain: { name: 'Chain', interval: 500, category: 'drivetrain', criticalThreshold: 0.85 },
  battery_water: { name: 'Battery Water', interval: 500, category: 'electrical', criticalThreshold: 0.9 },
  air_filter_clean: { name: 'Air Filter (Clean)', interval: 500, category: 'engine', criticalThreshold: 0.8 },
  brake_check: { name: 'Brake System', interval: 500, category: 'safety', criticalThreshold: 0.85 },
  cables: { name: 'Cables', interval: 500, category: 'controls', criticalThreshold: 0.8 },
  engine_oil: { name: 'Engine Oil', interval: 1000, category: 'engine', criticalThreshold: 0.9 },
  spark_plug: { name: 'Spark Plug', interval: 1000, category: 'ignition', criticalThreshold: 0.85 },
  carburetor: { name: 'Carburetor', interval: 1000, category: 'fuel', criticalThreshold: 0.8 },
  chain_sprockets: { name: 'Chain & Sprockets', interval: 1000, category: 'drivetrain', criticalThreshold: 0.85 },
  oil_filter: { name: 'Oil Filter', interval: 4000, category: 'engine', criticalThreshold: 0.9 },
  air_filter_replace: { name: 'Air Filter (Replace)', interval: 4000, category: 'engine', criticalThreshold: 0.85 },
  valve_clearance: { name: 'Valve Clearance', interval: 4000, category: 'engine', criticalThreshold: 0.8 },
  battery_test: { name: 'Battery Test', interval: 4000, category: 'electrical', criticalThreshold: 0.85 },
  brake_fluid_flush: { name: 'Brake Fluid', interval: 11000, category: 'safety', criticalThreshold: 0.9 },
  clutch_plates: { name: 'Clutch Plates', interval: 11000, category: 'drivetrain', criticalThreshold: 0.85 },
  suspension: { name: 'Suspension', interval: 11000, category: 'chassis', criticalThreshold: 0.8 },
  engine_overhaul: { name: 'Engine Overhaul', interval: 20000, category: 'engine', criticalThreshold: 0.95 },
  transmission_oil: { name: 'Transmission Oil', interval: 20000, category: 'drivetrain', criticalThreshold: 0.9 },
  wiring_harness: { name: 'Wiring Harness', interval: 20000, category: 'electrical', criticalThreshold: 0.85 },
};

// ============== PREDICTIVE ANALYTICS ENGINE ==============

/**
 * Calculate linear regression for wear prediction
 * Uses least squares method to find trend line
 */
const linearRegression = (data) => {
  if (!data || data.length < 2) return null;
  
  const n = data.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  
  data.forEach(point => {
    sumX += point.km;
    sumY += point.wearLevel;
    sumXY += point.km * point.wearLevel;
    sumX2 += point.km * point.km;
  });
  
  const denominator = n * sumX2 - sumX * sumX;
  if (denominator === 0) return null;
  
  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;
  
  // R-squared (coefficient of determination)
  const meanY = sumY / n;
  let ssTotal = 0, ssResidual = 0;
  data.forEach(point => {
    const predicted = slope * point.km + intercept;
    ssTotal += Math.pow(point.wearLevel - meanY, 2);
    ssResidual += Math.pow(point.wearLevel - predicted, 2);
  });
  const rSquared = ssTotal > 0 ? 1 - (ssResidual / ssTotal) : 0;
  
  return { slope, intercept, rSquared, dataPoints: n };
};

/**
 * Predict when maintenance will be needed
 * Returns estimated km until service required
 */
const predictNextService = (itemKey, currentKm, lastServiceKm, wearHistory) => {
  const item = MAINTENANCE_ITEMS[itemKey];
  if (!item) return null;
  
  // Ensure currentKm is a valid number
  const validCurrentKm = typeof currentKm === 'number' && !isNaN(currentKm) ? currentKm : 0;
  const validLastServiceKm = typeof lastServiceKm === 'number' && !isNaN(lastServiceKm) ? lastServiceKm : 0;
  
  const baseInterval = item.interval;
  const criticalThreshold = item.criticalThreshold;
  
  // Calculate basic wear info first
  const kmSinceService = Math.max(0, validCurrentKm - validLastServiceKm);
  const basicWearPercent = Math.min(100, (kmSinceService / baseInterval) * 100);
  
  // If we have enough valid history data points, use regression
  if (wearHistory && Array.isArray(wearHistory) && wearHistory.length >= 3) {
    // Ensure all data points are valid
    const validHistory = wearHistory.filter(point => 
      point && 
      typeof point.km === 'number' && !isNaN(point.km) &&
      typeof point.wearLevel === 'number' && !isNaN(point.wearLevel)
    );
    
    if (validHistory.length >= 3) {
      const regression = linearRegression(validHistory);
      
      if (regression && regression.rSquared > 0.3 && regression.slope > 0) {
        // Predict when wear will reach critical threshold (e.g., 90%)
        const kmToFailure = (criticalThreshold * 100 - regression.intercept) / regression.slope;
        const predictedKmRemaining = Math.max(0, kmToFailure - validCurrentKm);
        
        // Sanity check: prediction should be reasonable (not more than 3x base interval)
        const maxReasonable = baseInterval * 3;
        const clampedPrediction = Math.min(maxReasonable, predictedKmRemaining);
        
        return {
          predictedKm: Math.round(clampedPrediction),
          confidence: Math.min(95, Math.max(30, Math.round(regression.rSquared * 100))),
          method: 'ai_regression',
          wearRate: regression.slope,
          currentWear: basicWearPercent,
          isAnomalous: Math.abs(regression.slope) > (100 / baseInterval) * 1.5, // 50% faster than expected
          dataPoints: validHistory.length,
        };
      }
    }
  }
  
  // Fallback: simple calculation based on last service
  const kmRemaining = Math.max(0, baseInterval - kmSinceService);
  return {
    predictedKm: Math.round(kmRemaining),
    confidence: 60, // Lower confidence for simple calculation
    method: 'interval_based',
    wearRate: 100 / baseInterval,
    currentWear: basicWearPercent,
    isAnomalous: false,
    dataPoints: 0,
  };
};

/**
 * Detect anomalies in wear patterns
 * Returns warnings for parts wearing faster than expected
 */
const detectAnomalies = (wearPatterns, currentKm) => {
  const anomalies = [];
  
  if (!wearPatterns || typeof wearPatterns !== 'object') return anomalies;
  
  Object.entries(wearPatterns).forEach(([itemKey, history]) => {
    if (!history || !Array.isArray(history) || history.length < 3) return;
    
    const item = MAINTENANCE_ITEMS[itemKey];
    if (!item) return;
    
    // Validate history data points
    const validHistory = history.filter(point => 
      point && 
      typeof point.km === 'number' && !isNaN(point.km) &&
      typeof point.wearLevel === 'number' && !isNaN(point.wearLevel)
    );
    
    if (validHistory.length < 3) return;
    
    const expectedRate = 100 / item.interval; // Expected wear per km
    const regression = linearRegression(validHistory);
    
    if (regression && regression.slope > 0 && regression.rSquared > 0.3) {
      const actualRate = regression.slope;
      const rateRatio = actualRate / expectedRate;
      
      if (rateRatio > 1.5) {
        anomalies.push({
          itemKey,
          itemName: item.name,
          severity: rateRatio > 2 ? 'critical' : 'warning',
          message: `Wearing ${Math.round((rateRatio - 1) * 100)}% faster than expected`,
          possibleCauses: getPossibleCauses(itemKey, rateRatio),
          recommendation: getRecommendation(itemKey, rateRatio),
        });
      }
    }
  });
  
  return anomalies;
};

/**
 * Get possible causes for abnormal wear
 */
const getPossibleCauses = (itemKey, rateRatio) => {
  const causes = {
    tire_pressure: ['Under/over inflation', 'Misalignment', 'Overloading', 'Rough road conditions'],
    chain: ['Lack of lubrication', 'Misalignment', 'Debris contamination', 'Incorrect tension'],
    brake_check: ['Aggressive braking', 'Contaminated pads', 'Misaligned calipers', 'Heavy loads'],
    engine_oil: ['Short trips (no warm-up)', 'Dusty conditions', 'Engine wear', 'Oil leaks'],
    spark_plug: ['Rich fuel mixture', 'Oil contamination', 'Carbon buildup', 'Wrong heat range'],
    air_filter_clean: ['Dusty environment', 'Poor sealing', 'High usage'],
    battery_water: ['High temperatures', 'Overcharging', 'Old battery'],
    carburetor: ['Dirty fuel', 'Air leaks', 'Worn jets'],
  };
  
  return causes[itemKey] || ['Heavy usage', 'Environmental factors', 'Component quality'];
};

/**
 * Get recommendations for abnormal wear
 */
const getRecommendation = (itemKey, rateRatio) => {
  if (rateRatio > 2) {
    return 'Immediate inspection recommended. Consider checking related components.';
  }
  return 'Monitor closely and consider more frequent maintenance intervals.';
};

/**
 * Calculate overall vehicle health score
 */
const calculateHealthScore = (maintenanceData, currentKm, predictions) => {
  let totalWeight = 0;
  let weightedScore = 0;
  
  // Validate currentKm
  const validCurrentKm = typeof currentKm === 'number' && !isNaN(currentKm) ? currentKm : 0;
  
  // Weight categories by importance
  const categoryWeights = {
    safety: 1.5,
    engine: 1.3,
    drivetrain: 1.2,
    electrical: 1.0,
    fuel: 1.0,
    ignition: 1.0,
    controls: 0.9,
    chassis: 0.9,
  };
  
  Object.entries(MAINTENANCE_ITEMS).forEach(([itemKey, item]) => {
    const lastService = maintenanceData?.[itemKey] || 0;
    const validLastService = typeof lastService === 'number' && !isNaN(lastService) ? lastService : 0;
    const kmSinceService = Math.max(0, validCurrentKm - validLastService);
    const wearPercent = Math.min(100, (kmSinceService / item.interval) * 100);
    
    // Health is inverse of wear (100 - wear%)
    const health = Math.max(0, 100 - wearPercent);
    const weight = categoryWeights[item.category] || 1.0;
    
    totalWeight += weight;
    weightedScore += health * weight;
  });
  
  return totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 100;
};

/**
 * Get days until next service based on average daily km
 */
const calculateDaysUntilService = (kmRemaining, dailyKmAverage) => {
  if (!dailyKmAverage || dailyKmAverage <= 0) return null;
  if (!kmRemaining || kmRemaining <= 0) return 0;
  const days = Math.round(kmRemaining / dailyKmAverage);
  return Math.max(0, days); // Never return negative days
};

// ============== UI COMPONENTS ==============

/**
 * Circular Progress/Health Score Display
 */
const HealthScoreGauge = ({ score, size = 140 }) => {
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const center = size / 2;
  
  const getScoreColor = () => {
    if (score >= 80) return '#22c55e';
    if (score >= 60) return '#84cc16';
    if (score >= 40) return '#eab308';
    if (score >= 20) return '#f97316';
    return '#ef4444';
  };
  
  const getScoreLabel = () => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    if (score >= 20) return 'Poor';
    return 'Critical';
  };
  
  return (
    <View style={styles.gaugeContainer}>
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id="scoreGradient" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={getScoreColor()} stopOpacity="1" />
            <Stop offset="1" stopColor={getScoreColor()} stopOpacity="0.6" />
          </LinearGradient>
        </Defs>
        
        {/* Background circle */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke="#1e293b"
          strokeWidth={strokeWidth}
          fill="none"
        />
        
        {/* Progress arc */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke="url(#scoreGradient)"
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${progress} ${circumference}`}
          transform={`rotate(-90 ${center} ${center})`}
        />
        
        {/* Score text */}
        <SvgText
          x={center}
          y={center - 8}
          fontSize="32"
          fontWeight="bold"
          fill="#fff"
          textAnchor="middle"
        >
          {score}
        </SvgText>
        <SvgText
          x={center}
          y={center + 18}
          fontSize="12"
          fill="#94a3b8"
          textAnchor="middle"
        >
          {getScoreLabel()}
        </SvgText>
      </Svg>
    </View>
  );
};

/**
 * Prediction Card Component
 */
const PredictionCard = ({ prediction, itemName, onPress }) => {
  const kmValue = prediction.predictedKm || 0;
  const daysValue = prediction.daysRemaining;
  const confidenceValue = prediction.confidence || 60;
  
  const getUrgencyColor = () => {
    if (kmValue <= 50) return '#ef4444';
    if (kmValue <= 200) return '#f97316';
    if (kmValue <= 500) return '#eab308';
    return '#22c55e';
  };
  
  const getUrgencyLabel = () => {
    if (kmValue <= 50) return 'Urgent';
    if (kmValue <= 200) return 'Soon';
    if (kmValue <= 500) return 'Upcoming';
    return 'Good';
  };
  
  // Format km display
  const formatKm = (km) => {
    if (km <= 0) return 'Due now';
    if (km >= 1000) return `${(km / 1000).toFixed(1)}k km`;
    return `${Math.round(km)} km`;
  };
  
  // Format days display
  const formatDays = (days) => {
    if (days == null || days === undefined) return null;
    if (days <= 0) return 'Due now';
    if (days === 1) return '~1 day';
    if (days >= 30) return `~${Math.round(days / 30)} mo`;
    return `~${Math.round(days)} days`;
  };
  
  return (
    <TouchableOpacity style={styles.predictionCard} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.urgencyIndicator, { backgroundColor: getUrgencyColor() }]} />
      <View style={styles.predictionContent}>
        <View style={styles.predictionHeader}>
          <Text style={styles.predictionItemName} numberOfLines={1}>{itemName}</Text>
          <View style={[styles.urgencyBadge, { backgroundColor: getUrgencyColor() + '20' }]}>
            <Text style={[styles.urgencyText, { color: getUrgencyColor() }]}>{getUrgencyLabel()}</Text>
          </View>
        </View>
        
        <View style={styles.predictionDetails}>
          <View style={styles.predictionStat}>
            <Ionicons name="speedometer-outline" size={14} color="#64748b" />
            <Text style={styles.predictionStatText}>{formatKm(kmValue)}</Text>
          </View>
          
          {formatDays(daysValue) && (
            <View style={styles.predictionStat}>
              <Ionicons name="calendar-outline" size={14} color="#64748b" />
              <Text style={styles.predictionStatText}>{formatDays(daysValue)}</Text>
            </View>
          )}
          
          <View style={styles.predictionStat}>
            <Ionicons name="analytics-outline" size={14} color="#64748b" />
            <Text style={styles.predictionStatText}>{confidenceValue}%</Text>
          </View>
        </View>
        
        {prediction.method === 'ai_regression' && (
          <View style={styles.aiTag}>
            <Ionicons name="sparkles" size={10} color="#a78bfa" />
            <Text style={styles.aiTagText}>AI Predicted</Text>
          </View>
        )}
        
        {prediction.isAnomalous && (
          <View style={styles.anomalyWarning}>
            <Ionicons name="warning" size={12} color="#f97316" />
            <Text style={styles.anomalyText}>Faster wear detected</Text>
          </View>
        )}
      </View>
      <Ionicons name="chevron-forward" size={16} color="#475569" />
    </TouchableOpacity>
  );
};

/**
 * Anomaly Alert Component
 */
const AnomalyAlert = ({ anomaly, onDismiss }) => {
  const isCritical = anomaly.severity === 'critical';
  
  return (
    <View style={[styles.anomalyCard, isCritical && styles.anomalyCritical]}>
      <View style={styles.anomalyHeader}>
        <View style={styles.anomalyIcon}>
          <Ionicons 
            name={isCritical ? "warning" : "alert-circle"} 
            size={20} 
            color={isCritical ? "#ef4444" : "#f97316"} 
          />
        </View>
        <View style={styles.anomalyInfo}>
          <Text style={styles.anomalyTitle}>{anomaly.itemName}</Text>
          <Text style={styles.anomalyMessage}>{anomaly.message}</Text>
        </View>
        <TouchableOpacity onPress={onDismiss}>
          <Ionicons name="close" size={18} color="#64748b" />
        </TouchableOpacity>
      </View>
      
      <View style={styles.anomalyCauses}>
        <Text style={styles.causesTitle}>Possible causes:</Text>
        {anomaly.possibleCauses.slice(0, 3).map((cause, idx) => (
          <View key={idx} style={styles.causeItem}>
            <View style={styles.causeBullet} />
            <Text style={styles.causeText}>{cause}</Text>
          </View>
        ))}
      </View>
      
      <View style={styles.anomalyRecommendation}>
        <Ionicons name="bulb-outline" size={14} color="#60a5fa" />
        <Text style={styles.recommendationText}>{anomaly.recommendation}</Text>
      </View>
    </View>
  );
};

/**
 * Insights Card Component
 */
const InsightCard = ({ icon, title, value, subtitle, color }) => (
  <View style={styles.insightCard}>
    <View style={[styles.insightIcon, { backgroundColor: color + '20' }]}>
      <Ionicons name={icon} size={20} color={color} />
    </View>
    <Text style={styles.insightValue}>{String(value)}</Text>
    <Text style={styles.insightTitle}>{title}</Text>
    {subtitle ? <Text style={styles.insightSubtitle}>{subtitle}</Text> : null}
  </View>
);

// ============== MAIN COMPONENT ==============

const PredictiveMaintenance = ({ maintenanceData, tricycleId, onMaintenanceNeeded, currentOdometer }) => {
  const [loading, setLoading] = useState(true);
  const [currentKm, setCurrentKm] = useState(0);
  const [wearPatterns, setWearPatterns] = useState({});
  const [maintenanceHistory, setMaintenanceHistory] = useState([]);
  const [dailyKmAverage, setDailyKmAverage] = useState(30); // Default 30 km/day
  const [expandedSection, setExpandedSection] = useState('predictions');
  const [dismissedAnomalies, setDismissedAnomalies] = useState([]);
  const [showAllPredictions, setShowAllPredictions] = useState(false);
  
  // Load data on mount
  useEffect(() => {
    loadData();
  }, [tricycleId, maintenanceData, currentOdometer]);
  
  const loadData = async () => {
    try {
      setLoading(true);
      
      // Use passed currentOdometer first, then fallback to AsyncStorage
      let km = 0;
      if (currentOdometer != null && currentOdometer > 0) {
        km = currentOdometer;
      } else {
        // Load from AsyncStorage - try tricycle-specific key first
        const tricycleKmKey = tricycleId ? `${KM_KEY}_${tricycleId}` : KM_KEY;
        let kmStr = await AsyncStorage.getItem(tricycleKmKey);
        
        // Fallback to global key if tricycle-specific not found
        if (!kmStr) {
          kmStr = await AsyncStorage.getItem(KM_KEY);
        }
        km = kmStr ? parseFloat(kmStr) : 0;
      }
      setCurrentKm(km);
      
      // Load wear patterns
      const patternsKey = tricycleId ? `${WEAR_PATTERNS_KEY}_${tricycleId}` : WEAR_PATTERNS_KEY;
      const patternsStr = await AsyncStorage.getItem(patternsKey);
      if (patternsStr) {
        const patterns = JSON.parse(patternsStr);
        // Validate and clean wear patterns data
        const cleanedPatterns = {};
        Object.entries(patterns).forEach(([key, history]) => {
          if (Array.isArray(history)) {
            // Filter out invalid entries and ensure numeric values
            const validHistory = history.filter(point => 
              point && 
              typeof point.km === 'number' && 
              !isNaN(point.km) && 
              typeof point.wearLevel === 'number' && 
              !isNaN(point.wearLevel)
            );
            if (validHistory.length > 0) {
              cleanedPatterns[key] = validHistory;
            }
          }
        });
        setWearPatterns(cleanedPatterns);
      }
      
      // Load maintenance history
      const historyKey = tricycleId ? `${MAINTENANCE_HISTORY_KEY}_${tricycleId}` : MAINTENANCE_HISTORY_KEY;
      const historyStr = await AsyncStorage.getItem(historyKey);
      if (historyStr) {
        const history = JSON.parse(historyStr);
        // Filter valid history entries
        const validHistory = history.filter(entry => 
          entry && 
          entry.date && 
          typeof entry.km === 'number' && 
          !isNaN(entry.km)
        );
        setMaintenanceHistory(validHistory);
        
        // Calculate daily km average from history
        if (validHistory.length >= 2) {
          // Sort by date to get proper first and last
          const sorted = [...validHistory].sort((a, b) => 
            new Date(a.date).getTime() - new Date(b.date).getTime()
          );
          const firstEntry = sorted[0];
          const lastEntry = sorted[sorted.length - 1];
          const daysDiff = (new Date(lastEntry.date).getTime() - new Date(firstEntry.date).getTime()) / (1000 * 60 * 60 * 24);
          const kmDiff = Math.abs(lastEntry.km - firstEntry.km);
          if (daysDiff > 1 && kmDiff > 0) {
            const avgKm = Math.round(kmDiff / daysDiff);
            // Sanity check: between 5-200 km/day
            setDailyKmAverage(Math.min(200, Math.max(5, avgKm)));
          }
        }
      }
    } catch (error) {
      console.warn('Error loading predictive data:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Generate predictions for all items
  const predictions = useMemo(() => {
    const result = [];
    
    Object.entries(MAINTENANCE_ITEMS).forEach(([itemKey, item]) => {
      const lastServiceKm = maintenanceData?.[itemKey] || 0;
      const itemHistory = wearPatterns[itemKey] || [];
      
      const prediction = predictNextService(itemKey, currentKm, lastServiceKm, itemHistory);
      if (prediction) {
        prediction.itemKey = itemKey;
        prediction.itemName = item.name;
        prediction.category = item.category;
        prediction.daysRemaining = calculateDaysUntilService(prediction.predictedKm, dailyKmAverage);
        result.push(prediction);
      }
    });
    
    // Sort by urgency (lowest km first)
    return result.sort((a, b) => a.predictedKm - b.predictedKm);
  }, [maintenanceData, currentKm, wearPatterns, dailyKmAverage]);
  
  // Detect anomalies
  const anomalies = useMemo(() => {
    return detectAnomalies(wearPatterns, currentKm)
      .filter(a => !dismissedAnomalies.includes(a.itemKey));
  }, [wearPatterns, currentKm, dismissedAnomalies]);
  
  // Calculate health score
  const healthScore = useMemo(() => {
    return calculateHealthScore(maintenanceData || {}, currentKm, predictions);
  }, [maintenanceData, currentKm, predictions]);
  
  // Get stats for insights
  const stats = useMemo(() => {
    const urgent = predictions.filter(p => p.predictedKm <= 100).length;
    const upcoming = predictions.filter(p => p.predictedKm <= 500 && p.predictedKm > 100).length;
    const aiPredictions = predictions.filter(p => p.method === 'ai_regression').length;
    const nextService = predictions[0];
    
    return { urgent, upcoming, aiPredictions, nextService };
  }, [predictions]);
  
  const dismissAnomaly = (itemKey) => {
    setDismissedAnomalies(prev => [...prev, itemKey]);
  };
  
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#60a5fa" />
        <Text style={styles.loadingText}>Analyzing maintenance data...</Text>
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="analytics" size={24} color="#60a5fa" />
          <View>
            <Text style={styles.title}>Predictive Maintenance</Text>
            <Text style={styles.subtitle}>AI-powered maintenance insights</Text>
          </View>
        </View>
      </View>
      
      {/* Health Score Section */}
      <View style={styles.healthSection}>
        <HealthScoreGauge score={healthScore} />
        <View style={styles.healthInfo}>
          <Text style={styles.healthTitle}>Vehicle Health</Text>
          <Text style={styles.healthDescription}>
            Based on {Object.keys(maintenanceData || {}).length} tracked components
          </Text>
          
          {/* Quick Stats */}
          <View style={styles.quickStats}>
            {stats.urgent > 0 && (
              <View style={[styles.quickStat, { backgroundColor: '#ef444420' }]}>
                <Text style={[styles.quickStatText, { color: '#ef4444' }]}>
                  {stats.urgent} urgent
                </Text>
              </View>
            )}
            {stats.upcoming > 0 && (
              <View style={[styles.quickStat, { backgroundColor: '#f9731620' }]}>
                <Text style={[styles.quickStatText, { color: '#f97316' }]}>
                  {stats.upcoming} upcoming
                </Text>
              </View>
            )}
            {stats.aiPredictions > 0 && (
              <View style={[styles.quickStat, { backgroundColor: '#a78bfa20' }]}>
                <Text style={[styles.quickStatText, { color: '#a78bfa' }]}>
                  {stats.aiPredictions} AI insights
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
      
      {/* Insights Row */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.insightsScroll}>
        <View style={styles.insightsRow}>
          <InsightCard
            icon="speedometer"
            title="Daily Average"
            value={`${dailyKmAverage} km`}
            subtitle="Based on history"
            color="#60a5fa"
          />
          <InsightCard
            icon="time-outline"
            title="Next Service"
            value={stats.nextService ? (
              stats.nextService.predictedKm <= 0 ? 'Due now' :
              stats.nextService.predictedKm >= 1000 ? `${(stats.nextService.predictedKm / 1000).toFixed(1)}k km` :
              `${stats.nextService.predictedKm} km`
            ) : 'N/A'}
            subtitle={stats.nextService?.itemName?.substring(0, 15) || null}
            color={stats.nextService?.predictedKm <= 100 ? '#ef4444' : '#22c55e'}
          />
          <InsightCard
            icon="calendar"
            title="Est. Days"
            value={
              stats.nextService?.daysRemaining != null 
                ? (stats.nextService.daysRemaining <= 0 ? 'Now' : String(stats.nextService.daysRemaining))
                : 'N/A'
            }
            subtitle="Until service"
            color={stats.nextService?.daysRemaining <= 3 ? '#ef4444' : '#eab308'}
          />
          <InsightCard
            icon="sparkles"
            title="AI Confidence"
            value={`${Math.round(predictions.reduce((sum, p) => sum + (p.confidence || 60), 0) / Math.max(predictions.length, 1))}%`}
            subtitle="Avg. prediction"
            color="#a78bfa"
          />
        </View>
      </ScrollView>
      
      {/* Anomaly Alerts */}
      {anomalies.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="warning" size={18} color="#f97316" />
            <Text style={styles.sectionTitle}>Anomaly Detection</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{anomalies.length}</Text>
            </View>
          </View>
          {anomalies.map((anomaly, idx) => (
            <AnomalyAlert
              key={anomaly.itemKey}
              anomaly={anomaly}
              onDismiss={() => dismissAnomaly(anomaly.itemKey)}
            />
          ))}
        </View>
      )}
      
      {/* Predictions List */}
      <View style={styles.section}>
        <TouchableOpacity 
          style={styles.sectionHeader}
          onPress={() => setExpandedSection(expandedSection === 'predictions' ? null : 'predictions')}
        >
          <Ionicons name="flash" size={18} color="#60a5fa" />
          <Text style={styles.sectionTitle}>Maintenance Predictions</Text>
          <Ionicons 
            name={expandedSection === 'predictions' ? 'chevron-up' : 'chevron-down'} 
            size={18} 
            color="#64748b" 
          />
        </TouchableOpacity>
        
        {expandedSection === 'predictions' && (
          <View style={styles.predictionsContainer}>
            {(showAllPredictions ? predictions : predictions.slice(0, 6)).map((prediction) => (
              <PredictionCard
                key={prediction.itemKey}
                prediction={prediction}
                itemName={prediction.itemName}
                onPress={() => {
                  if (prediction.predictedKm <= 100) {
                    onMaintenanceNeeded?.(prediction.itemKey);
                  }
                }}
              />
            ))}
            
            {predictions.length > 6 && (
              <TouchableOpacity 
                style={styles.showMoreBtn}
                onPress={() => setShowAllPredictions(!showAllPredictions)}
                activeOpacity={0.7}
              >
                <Text style={styles.showMoreText}>
                  {showAllPredictions ? 'Show less' : `Show ${predictions.length - 6} more`}
                </Text>
                <Ionicons 
                  name={showAllPredictions ? "chevron-up" : "chevron-down"} 
                  size={14} 
                  color="#60a5fa" 
                />
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
      
      {/* AI Methodology Note */}
      <View style={styles.methodologyNote}>
        <Ionicons name="information-circle-outline" size={14} color="#64748b" />
        <Text style={styles.methodologyText}>
          Predictions use linear regression on your maintenance history. More data improves accuracy.
        </Text>
      </View>
    </View>
  );
};

// ============== STYLES ==============

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: spacing.medium,
    borderWidth: 1,
    borderColor: '#1e3a5f',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f172a',
    borderRadius: 16,
  },
  loadingText: {
    marginTop: 12,
    color: '#64748b',
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.medium,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f1f5f9',
  },
  subtitle: {
    fontSize: 12,
    color: '#64748b',
  },
  
  // Health Score Section
  healthSection: {
    flexDirection: 'row',
    padding: spacing.medium,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  gaugeContainer: {
    marginRight: spacing.medium,
  },
  healthInfo: {
    flex: 1,
  },
  healthTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e2e8f0',
    marginBottom: 4,
  },
  healthDescription: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 12,
  },
  quickStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  quickStat: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  quickStatText: {
    fontSize: 11,
    fontWeight: '600',
  },
  
  // Insights
  insightsScroll: {
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  insightsRow: {
    flexDirection: 'row',
    padding: spacing.medium,
    gap: 12,
  },
  insightCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 12,
    minWidth: 90,
    maxWidth: 110,
    flex: 1,
    alignItems: 'center',
  },
  insightIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  insightValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f1f5f9',
  },
  insightTitle: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
    textAlign: 'center',
  },
  insightSubtitle: {
    fontSize: 9,
    color: '#64748b',
    marginTop: 2,
    textAlign: 'center',
  },
  
  // Sections
  section: {
    padding: spacing.medium,
    paddingTop: spacing.small,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  sectionTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#e2e8f0',
  },
  badge: {
    backgroundColor: '#f9731620',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#f97316',
  },
  
  // Predictions
  predictionsContainer: {
    gap: 8,
    marginTop: 8,
  },
  predictionCard: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    position: 'relative',
  },
  urgencyIndicator: {
    width: 4,
    height: '100%',
    position: 'absolute',
    left: 0,
    top: 0,
    borderTopLeftRadius: 10,
    borderBottomLeftRadius: 10,
  },
  predictionContent: {
    flex: 1,
    marginLeft: 8,
  },
  predictionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  predictionItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#e2e8f0',
    flex: 1,
  },
  urgencyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    flexShrink: 0,
  },
  urgencyText: {
    fontSize: 10,
    fontWeight: '600',
  },
  predictionDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 4,
  },
  predictionStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  predictionStatText: {
    fontSize: 11,
    color: '#94a3b8',
  },
  aiTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  aiTagText: {
    fontSize: 10,
    color: '#a78bfa',
    fontWeight: '500',
  },
  anomalyWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  anomalyText: {
    fontSize: 10,
    color: '#f97316',
    fontWeight: '500',
  },
  
  // Anomaly Cards
  anomalyCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#f97316',
  },
  anomalyCritical: {
    borderLeftColor: '#ef4444',
  },
  anomalyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  anomalyIcon: {
    marginRight: 10,
  },
  anomalyInfo: {
    flex: 1,
  },
  anomalyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#e2e8f0',
  },
  anomalyMessage: {
    fontSize: 12,
    color: '#f97316',
    marginTop: 2,
  },
  anomalyCauses: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  causesTitle: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 6,
  },
  causeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  causeBullet: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#64748b',
    marginRight: 8,
  },
  causeText: {
    fontSize: 11,
    color: '#94a3b8',
  },
  anomalyRecommendation: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  recommendationText: {
    flex: 1,
    fontSize: 11,
    color: '#60a5fa',
  },
  
  // Show More
  showMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    gap: 6,
    backgroundColor: '#1e293b',
    borderRadius: 10,
    marginTop: 4,
  },
  showMoreText: {
    fontSize: 13,
    color: '#60a5fa',
    fontWeight: '600',
  },
  
  // Methodology Note
  methodologyNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: spacing.medium,
    paddingTop: 0,
  },
  methodologyText: {
    flex: 1,
    fontSize: 10,
    color: '#64748b',
    fontStyle: 'italic',
  },
});

export default PredictiveMaintenance;

// Export helper functions for use in other components
export {
  predictNextService,
  detectAnomalies,
  calculateHealthScore,
  linearRegression,
  MAINTENANCE_ITEMS,
};
