import { RideDiagnostic } from "../models/rideDiagnosticModel.js";
import Tricycle from "../models/tricycleModel.js";
import { MaintenanceLog, MaintenanceScheduleGroup } from "../models/maintenanceScheduleModel.js";

// ==================== RIDE DIAGNOSTIC ENDPOINTS ====================

// Submit a ride diagnostic survey
export const submitRideDiagnostic = async (req, res) => {
    try {
        const { tricycleId } = req.params;
        const { overallRating, answers, diagnostics, odometerReading, drivingConditions, dailyUsageHours } = req.body;
        const userId = req.user?._id;

        if (!overallRating || !answers) {
            return res.status(400).json({
                success: false,
                message: 'Overall rating and answers are required'
            });
        }

        // Verify tricycle exists
        const tricycle = await Tricycle.findById(tricycleId);
        if (!tricycle) {
            return res.status(404).json({
                success: false,
                message: 'Tricycle not found'
            });
        }

        // Validate odometer is not going backwards
        if (odometerReading != null) {
            const lastWithOdometer = await RideDiagnostic.findOne(
                { tricycleId, odometerReading: { $ne: null } }
            ).sort({ surveyedAt: -1 }).lean();
            if (lastWithOdometer && odometerReading < lastWithOdometer.odometerReading) {
                return res.status(400).json({
                    success: false,
                    message: `Odometer reading cannot be less than the last recorded value (${lastWithOdometer.odometerReading} km)`
                });
            }
        }

        // Count issues by urgency
        const issueCount = diagnostics?.length || 0;
        const criticalCount = diagnostics?.filter(d => d.urgency === 'critical').length || 0;
        const highCount = diagnostics?.filter(d => d.urgency === 'high').length || 0;
        const mediumCount = diagnostics?.filter(d => d.urgency === 'medium').length || 0;

        const diagnostic = await RideDiagnostic.create({
            tricycleId,
            submittedBy: userId,
            overallRating,
            answers: new Map(Object.entries(answers)),
            diagnostics: diagnostics || [],
            issueCount,
            criticalCount,
            highCount,
            mediumCount,
            motorcycleModel: 'Motorcycle',
            odometerReading: odometerReading != null ? Number(odometerReading) : null,
            drivingConditions: drivingConditions || 'mixed',
            dailyUsageHours: dailyUsageHours != null ? Number(dailyUsageHours) : null,
        });

        res.status(201).json({
            success: true,
            message: 'Ride diagnostic recorded successfully',
            data: diagnostic,
        });
    } catch (error) {
        console.error('submitRideDiagnostic error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to record ride diagnostic',
            error: error.message,
        });
    }
};

// Get ride diagnostic history for a tricycle
export const getRideDiagnosticHistory = async (req, res) => {
    try {
        const { tricycleId } = req.params;
        const { limit = 20, page = 1 } = req.query;

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const diagnostics = await RideDiagnostic.find({ tricycleId })
            .sort({ surveyedAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .populate('submittedBy', 'name email')
            .lean();

        const total = await RideDiagnostic.countDocuments({ tricycleId });

        res.status(200).json({
            success: true,
            data: diagnostics,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / parseInt(limit)),
            },
        });
    } catch (error) {
        console.error('getRideDiagnosticHistory error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch ride diagnostic history',
            error: error.message,
        });
    }
};

// Get latest ride diagnostic for a tricycle
export const getLatestRideDiagnostic = async (req, res) => {
    try {
        const { tricycleId } = req.params;

        const diagnostic = await RideDiagnostic.findOne({ tricycleId })
            .sort({ surveyedAt: -1 })
            .populate('submittedBy', 'name email')
            .lean();

        if (!diagnostic) {
            return res.status(200).json({
                success: true,
                data: null,
                message: 'No ride diagnostic found for this tricycle',
            });
        }

        res.status(200).json({
            success: true,
            data: diagnostic,
        });
    } catch (error) {
        console.error('getLatestRideDiagnostic error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch latest ride diagnostic',
            error: error.message,
        });
    }
};

// Get ride diagnostic statistics for a tricycle
export const getRideDiagnosticStats = async (req, res) => {
    try {
        const { tricycleId } = req.params;
        const mongoose = (await import('mongoose')).default;

        const stats = await RideDiagnostic.aggregate([
            { $match: { tricycleId: new mongoose.Types.ObjectId(tricycleId) } },
            {
                $group: {
                    _id: null,
                    totalSurveys: { $sum: 1 },
                    avgRating: { $avg: '$overallRating' },
                    totalIssues: { $sum: '$issueCount' },
                    totalCritical: { $sum: '$criticalCount' },
                    totalHigh: { $sum: '$highCount' },
                    lastSurvey: { $max: '$surveyedAt' },
                }
            }
        ]);

        // Get most common symptoms
        const commonSymptoms = await RideDiagnostic.aggregate([
            { $match: { tricycleId: new mongoose.Types.ObjectId(tricycleId) } },
            { $unwind: '$diagnostics' },
            {
                $group: {
                    _id: '$diagnostics.symptomId',
                    symptom: { $first: '$diagnostics.symptom' },
                    categoryId: { $first: '$diagnostics.categoryId' },
                    count: { $sum: 1 },
                    avgSeverity: { $avg: '$diagnostics.severity' },
                }
            },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]);

        res.status(200).json({
            success: true,
            data: {
                summary: stats[0] || {
                    totalSurveys: 0,
                    avgRating: 0,
                    totalIssues: 0,
                    totalCritical: 0,
                    totalHigh: 0,
                    lastSurvey: null,
                },
                commonSymptoms,
            },
        });
    } catch (error) {
        console.error('getRideDiagnosticStats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch ride diagnostic statistics',
            error: error.message,
        });
    }
};

// ==================== ADAPTIVE LEARNING INSIGHTS ====================
// Mileage-based maintenance intervals
const MILEAGE_INTERVALS = [
    { km: 500, label: 'Initial Break-in Service', items: ['Engine Oil Change', 'Chain Lubrication', 'Bolt Retorque'] },
    { km: 1000, label: 'First Service', items: ['Engine Oil Change', 'Chain Lubrication', 'Spark Plug Check', 'Brake Adjustment'] },
    { km: 3000, label: 'Regular Service', items: ['Engine Oil Change', 'Air Filter Clean', 'Spark Plug Check', 'Chain Adjustment'] },
    { km: 5000, label: 'Intermediate Service', items: ['Engine Oil Change', 'Air Filter Replace', 'Spark Plug Replace', 'Valve Clearance Check', 'Brake Inspection'] },
    { km: 10000, label: 'Major Service', items: ['Engine Oil Change', 'Fork Oil Change', 'Brake Fluid Flush', 'Chain & Sprocket Replace', 'Carburetor Clean', 'Full Brake Overhaul'] },
    { km: 15000, label: 'Extended Service', items: ['Engine Oil Change', 'Clutch Plate Inspection', 'Steering Bearings Repack', 'Wheel Bearings Check', 'All Cables Replace'] },
    { km: 20000, label: 'Overhaul Assessment', items: ['Engine Top-End Inspection', 'Clutch Plate Replace', 'All Bearings Inspection', 'Full Electrical Check', 'Suspension Rebuild'] },
];

// Get adaptive learning insights for a tricycle
export const getAdaptiveInsights = async (req, res) => {
    try {
        const { tricycleId } = req.params;

        // Get all diagnostics for this tricycle, sorted newest first
        const allDiagnostics = await RideDiagnostic.find({ tricycleId })
            .sort({ surveyedAt: -1 })
            .lean();

        if (allDiagnostics.length === 0) {
            return res.status(200).json({
                success: true,
                data: {
                    recurringSymptoms: [],
                    categoryTrends: {},
                    mileageRecommendations: [],
                    healthScore: 100,
                    habitScore: 0,
                    totalSurveys: 0,
                    latestOdometer: 0,
                    odometerHistory: [],
                    avgDaysBetween: 0,
                    ratingTrend: [],
                    predictedIssues: [],
                }
            });
        }

        // ===== 1. RECURRING SYMPTOMS (learning from history) =====
        const symptomHistory = {};
        allDiagnostics.forEach(d => {
            d.diagnostics.forEach(diag => {
                if (!symptomHistory[diag.symptomId]) {
                    symptomHistory[diag.symptomId] = {
                        symptom: diag.symptom,
                        categoryId: diag.categoryId,
                        occurrences: 0,
                        severities: [],
                        dates: [],
                        partsToCheck: diag.partsToCheck || [],
                    };
                }
                symptomHistory[diag.symptomId].occurrences++;
                symptomHistory[diag.symptomId].severities.push(diag.severity);
                symptomHistory[diag.symptomId].dates.push(d.surveyedAt);
            });
        });

        const recurringSymptoms = Object.entries(symptomHistory)
            .filter(([_, v]) => v.occurrences >= 2)
            .map(([symptomId, data]) => {
                // Determine severity trend (are things getting worse?)
                const recentSev = data.severities.slice(0, Math.ceil(data.severities.length / 2));
                const olderSev = data.severities.slice(Math.ceil(data.severities.length / 2));
                const recentAvg = recentSev.reduce((a, b) => a + b, 0) / recentSev.length;
                const olderAvg = olderSev.length > 0
                    ? olderSev.reduce((a, b) => a + b, 0) / olderSev.length
                    : recentAvg;

                return {
                    symptomId,
                    symptom: data.symptom,
                    categoryId: data.categoryId,
                    occurrences: data.occurrences,
                    avgSeverity: Math.round((data.severities.reduce((a, b) => a + b, 0) / data.severities.length) * 10) / 10,
                    trend: recentAvg > olderAvg + 0.3 ? 'worsening' : recentAvg < olderAvg - 0.3 ? 'improving' : 'stable',
                    lastSeen: data.dates[0],
                    firstSeen: data.dates[data.dates.length - 1],
                    partsToCheck: data.partsToCheck,
                    // Higher urgency boost for chronic issues
                    urgencyBoost: data.occurrences >= 4 ? 2 : data.occurrences >= 3 ? 1 : 0,
                };
            })
            .sort((a, b) => b.occurrences - a.occurrences || b.avgSeverity - a.avgSeverity);

        // ===== 2. CATEGORY TRENDS (per-system health over time) =====
        const CATEGORIES = ['engine', 'braking', 'suspension', 'steering', 'transmission', 'electrical', 'drivetrain', 'exhaust'];
        const categoryTrends = {};

        CATEGORIES.forEach(cat => {
            // Collect severity for each survey (0 if no issue in that category)
            const surveySeverities = allDiagnostics.map(d => {
                const issue = d.diagnostics.find(diag => diag.categoryId === cat);
                return issue ? issue.severity : 0;
            });

            if (surveySeverities.length >= 2) {
                const recent = surveySeverities.slice(0, Math.min(3, surveySeverities.length));
                const older = surveySeverities.slice(Math.min(3, surveySeverities.length));
                const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
                const olderAvg = older.length > 0 ? older.reduce((a, b) => a + b, 0) / older.length : recentAvg;

                categoryTrends[cat] = {
                    trend: recentAvg > olderAvg + 0.5 ? 'worsening' : recentAvg < olderAvg - 0.5 ? 'improving' : 'stable',
                    recentAvgSeverity: Math.round(recentAvg * 10) / 10,
                    change: Math.round((recentAvg - olderAvg) * 10) / 10,
                    dataPoints: surveySeverities.length,
                };
            } else {
                categoryTrends[cat] = {
                    trend: 'insufficient_data',
                    recentAvgSeverity: surveySeverities[0] || 0,
                    change: 0,
                    dataPoints: surveySeverities.length,
                };
            }
        });

        // ===== 3. MILEAGE-BASED RECOMMENDATIONS =====
        const latestOdometer = allDiagnostics.find(d => d.odometerReading != null)?.odometerReading || 0;
        const mileageRecommendations = [];

        if (latestOdometer > 0) {
            MILEAGE_INTERVALS.forEach(interval => {
                // Find the next upcoming interval
                const nextMilestone = Math.ceil(latestOdometer / interval.km) * interval.km;
                const kmUntil = nextMilestone - latestOdometer;
                const lastPerformed = Math.floor(latestOdometer / interval.km) * interval.km;

                if (kmUntil <= interval.km * 0.3) {
                    // Within 30% of next milestone — recommend soon
                    mileageRecommendations.push({
                        label: interval.label,
                        nextAt: nextMilestone,
                        kmRemaining: kmUntil,
                        items: interval.items,
                        urgency: kmUntil <= 100 ? 'due_now' : 'upcoming',
                    });
                } else if (latestOdometer % interval.km < interval.km * 0.05) {
                    // Just passed a milestone — remind
                    mileageRecommendations.push({
                        label: interval.label,
                        nextAt: latestOdometer,
                        kmRemaining: 0,
                        items: interval.items,
                        urgency: 'due_now',
                    });
                }
            });
        }

        // ===== 4. HEALTH SCORE (0–100, evolves with data) =====
        const last5 = allDiagnostics.slice(0, Math.min(5, allDiagnostics.length));
        const avgRating = last5.reduce((a, d) => a + d.overallRating, 0) / last5.length;
        const avgIssues = last5.reduce((a, d) => a + d.issueCount, 0) / last5.length;
        const avgCritical = last5.reduce((a, d) => a + d.criticalCount, 0) / last5.length;
        const avgHigh = last5.reduce((a, d) => a + d.highCount, 0) / last5.length;

        // Penalize recurring issues
        const recurringPenalty = Math.min(15, recurringSymptoms.length * 3);
        // Penalize worsening trends
        const worseningCount = Object.values(categoryTrends).filter(t => t.trend === 'worsening').length;
        const trendPenalty = worseningCount * 5;

        const healthScore = Math.max(0, Math.min(100, Math.round(
            (avgRating / 5) * 35 +                           // rating (35%)
            Math.max(0, (1 - avgIssues / 8)) * 25 +         // issue count (25%)
            Math.max(0, (1 - avgCritical / 2)) * 15 +       // critical issues (15%)
            Math.max(0, (1 - avgHigh / 3)) * 10 +           // high issues (10%)
            15 -                                              // base 15%
            recurringPenalty -                                // recurring issue penalty
            trendPenalty                                      // worsening trend penalty
        )));

        // ===== 5. HABIT SCORE (how diligent is the driver) =====
        const surveyDates = allDiagnostics.map(d => new Date(d.surveyedAt));
        let avgDaysBetween = 0;
        if (surveyDates.length >= 2) {
            const gaps = [];
            for (let i = 0; i < surveyDates.length - 1; i++) {
                gaps.push((surveyDates[i] - surveyDates[i + 1]) / (1000 * 60 * 60 * 24));
            }
            avgDaysBetween = Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length);
        }

        // Ideal check interval is 7 days. Score based on consistency.
        const consistencyScore = allDiagnostics.length <= 1 ? 30 :
            Math.max(0, Math.min(60, Math.round(60 - Math.max(0, avgDaysBetween - 7) * 2)));
        const frequencyScore = Math.min(40, allDiagnostics.length * 5);
        const habitScore = Math.min(100, consistencyScore + frequencyScore);

        // ===== 6. RATING TREND (how overall ride experience is changing) =====
        const ratingTrend = allDiagnostics.slice(0, 10).map(d => ({
            rating: d.overallRating,
            date: d.surveyedAt,
            issueCount: d.issueCount,
            odometer: d.odometerReading,
        })).reverse();

        // ===== 7. ODOMETER PROGRESSION =====
        const odometerHistory = allDiagnostics
            .filter(d => d.odometerReading != null)
            .map(d => ({ reading: d.odometerReading, date: d.surveyedAt }))
            .reverse();

        // ===== 8. PREDICTED ISSUES (pattern-based forecasting) =====
        const predictedIssues = [];
        // If a symptom occurred in 2+ of the last 3 surveys, predict it will recur
        const last3 = allDiagnostics.slice(0, 3);
        if (last3.length >= 2) {
            const recentSymptomCounts = {};
            last3.forEach(d => {
                d.diagnostics.forEach(diag => {
                    recentSymptomCounts[diag.symptomId] = (recentSymptomCounts[diag.symptomId] || 0) + 1;
                });
            });
            Object.entries(recentSymptomCounts)
                .filter(([_, count]) => count >= 2)
                .forEach(([symptomId, count]) => {
                    const hist = symptomHistory[symptomId];
                    if (hist) {
                        predictedIssues.push({
                            symptomId,
                            symptom: hist.symptom,
                            categoryId: hist.categoryId,
                            confidence: Math.min(95, Math.round((count / last3.length) * 100)),
                            reason: `Reported in ${count} of last ${last3.length} checkups`,
                            partsToCheck: hist.partsToCheck,
                        });
                    }
                });
        }

        // Mileage-based predictions
        if (latestOdometer > 0 && odometerHistory.length >= 2) {
            const totalKm = odometerHistory[odometerHistory.length - 1].reading - odometerHistory[0].reading;
            const totalDays = (new Date(odometerHistory[odometerHistory.length - 1].date) - new Date(odometerHistory[0].date)) / (1000 * 60 * 60 * 24);
            const kmPerDay = totalDays > 0 ? totalKm / totalDays : 0;

            if (kmPerDay > 0) {
                MILEAGE_INTERVALS.forEach(interval => {
                    const nextMilestone = Math.ceil(latestOdometer / interval.km) * interval.km;
                    const kmUntil = nextMilestone - latestOdometer;
                    const daysUntil = Math.round(kmUntil / kmPerDay);

                    if (daysUntil > 0 && daysUntil <= 30) {
                        predictedIssues.push({
                            symptomId: `mileage_${interval.km}`,
                            symptom: `${interval.label} due at ${nextMilestone.toLocaleString()} km`,
                            categoryId: 'mileage',
                            confidence: Math.min(90, Math.round(90 - (daysUntil * 2))),
                            reason: `Based on your avg ${Math.round(kmPerDay)} km/day, due in ~${daysUntil} days`,
                            partsToCheck: interval.items,
                        });
                    }
                });
            }
        }

        // ===== 9. MAINTENANCE LOG CROSS-REFERENCE =====
        // Pull scheduled maintenance log data to enrich diagnostic insights
        let maintenanceCrossRef = [];
        try {
            // Get approved maintenance logs for this tricycle
            const maintenanceLogs = await MaintenanceLog.find({
                tricycleId,
                approvalStatus: 'approved'
            }).sort({ completedAt: -1 }).lean();

            // Get the maintenance schedule groups for interval info
            const scheduleGroups = await MaintenanceScheduleGroup.find({ isActive: true }).sort({ sortOrder: 1 }).lean();

            // Build a map of part keys that have been flagged in diagnostics
            const diagnosticPartKeys = new Set();
            allDiagnostics.forEach(d => {
                d.diagnostics.forEach(diag => {
                    (diag.partsToCheck || []).forEach(pk => diagnosticPartKeys.add(pk));
                });
            });

            // Cross-reference: for each part flagged in checkups, find its maintenance status
            for (const partKey of diagnosticPartKeys) {
                // Find latest maintenance log for this part
                const latestLog = maintenanceLogs.find(l => l.itemKey === partKey);
                
                // Find the schedule group this part belongs to
                let scheduleGroup = null;
                let scheduleItem = null;
                for (const group of scheduleGroups) {
                    const item = group.items?.find(i => i.key === partKey);
                    if (item) {
                        scheduleGroup = group;
                        scheduleItem = item;
                        break;
                    }
                }

                if (scheduleItem) {
                    const intervalKm = scheduleGroup?.intervalKm || 1000;
                    const lastServiceKm = latestLog?.lastServiceKm || 0;
                    const kmSinceService = latestOdometer > 0 ? Math.max(0, latestOdometer - lastServiceKm) : 0;
                    const wearPercent = Math.min(100, Math.round((kmSinceService / intervalKm) * 100));

                    // Count how many times this part was flagged in diagnostics
                    let diagnosticFlagCount = 0;
                    let maxSeverity = 0;
                    allDiagnostics.forEach(d => {
                        d.diagnostics.forEach(diag => {
                            if ((diag.partsToCheck || []).includes(partKey)) {
                                diagnosticFlagCount++;
                                maxSeverity = Math.max(maxSeverity, diag.severity || 0);
                            }
                        });
                    });

                    // Calculate days since last service
                    let daysSinceService = null;
                    if (latestLog?.completedAt) {
                        daysSinceService = Math.floor((Date.now() - new Date(latestLog.completedAt).getTime()) / (1000 * 60 * 60 * 24));
                    }

                    // How many times this part has been serviced
                    const serviceCount = maintenanceLogs.filter(l => l.itemKey === partKey).length;

                    maintenanceCrossRef.push({
                        partKey,
                        partName: scheduleItem.name,
                        groupTitle: scheduleGroup.title,
                        intervalKm,
                        lastServiceKm,
                        kmSinceService,
                        wearPercent,
                        daysSinceService,
                        serviceCount,
                        diagnosticFlagCount,
                        maxDiagnosticSeverity: maxSeverity,
                        lastServiceDate: latestLog?.completedAt || null,
                        lastServiceStatus: latestLog?.status || null,
                        // Urgency: combine wear percent with diagnostic severity
                        combinedUrgency: wearPercent >= 80 || maxSeverity >= 4 ? 'critical'
                            : wearPercent >= 60 || maxSeverity >= 3 ? 'high'
                            : wearPercent >= 40 || maxSeverity >= 2 ? 'medium'
                            : 'low',
                    });
                }
            }

            // Sort by combined urgency (critical first)
            const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };
            maintenanceCrossRef.sort((a, b) => 
                (urgencyOrder[a.combinedUrgency] || 3) - (urgencyOrder[b.combinedUrgency] || 3)
            );
        } catch (crossRefError) {
            console.warn('Error building maintenance cross-reference:', crossRefError);
        }

        res.status(200).json({
            success: true,
            data: {
                recurringSymptoms,
                categoryTrends,
                mileageRecommendations,
                healthScore,
                habitScore,
                totalSurveys: allDiagnostics.length,
                latestOdometer,
                odometerHistory,
                avgDaysBetween,
                ratingTrend,
                predictedIssues,
                maintenanceCrossRef,
            },
        });
    } catch (error) {
        console.error('getAdaptiveInsights error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch adaptive insights',
            error: error.message,
        });
    }
};
