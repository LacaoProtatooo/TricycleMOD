# Maintenance System Documentation

## Overview

The maintenance feature is a comprehensive vehicle maintenance tracking system designed for tricycle operators and drivers. It combines scheduled maintenance intervals, predictive AI, ride diagnostics, and operator approval workflows.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        MOBILE CLIENT                             │
├─────────────────────────────────────────────────────────────────┤
│  MaintenanceTracker.jsx     │  PredictiveMaintenance.jsx        │
│  - Schedule display         │  - AI regression engine           │
│  - Completion workflow      │  - Adaptive intervals             │
│  - Notification scheduling  │  - Anomaly detection              │
│  - Odometer tracking        │  - Time decay calculations        │
├─────────────────────────────┴───────────────────────────────────┤
│  Supporting Components:                                          │
│  - CompletionModal.jsx     - SkipReasonModal.jsx                │
│  - OverdueCheckModal.jsx   - VehicleDiagnostic.jsx              │
│  - ServiceHistory.jsx      - RideExperienceSurvey.jsx           │
├─────────────────────────────────────────────────────────────────┤
│  Storage: AsyncStorage (offline cache) + Server Sync            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                          SERVER                                  │
├─────────────────────────────────────────────────────────────────┤
│  maintenanceScheduleController.js                               │
│  - Config management (schedule groups, skip reasons, statuses)  │
│  - Maintenance log API (CRUD with approval workflow)            │
│  - Proof image handling                                         │
├─────────────────────────────────────────────────────────────────┤
│  Models: MaintenanceScheduleGroup, SkipReason, CompletionStatus │
│          MaintenanceLog (approvalStatus: pending/approved/rejected)
└─────────────────────────────────────────────────────────────────┘
```

---

## Schedule Configuration

### Default Schedule Groups

The server provides 5 schedule groups with different intervals:

| Group | Time Interval | KM Interval | Items |
|-------|---------------|-------------|-------|
| Weekly Check | 7 days | 500 km | tire_pressure, chain, battery_water, air_filter_clean |
| Monthly Check | 30 days | 1000 km | brake_check, cables, lights, fuel_filter |
| Quarterly Service | 90 days | 4000 km | engine_oil, spark_plug, carburetor, suspension |
| Annual Service | 365 days | 11000 km | clutch, electrical, body_frame, coolant |
| Bi-Annual Service | 730 days | 20000 km | engine_overhaul, transmission |

### Config Sync Flow

```
1. App starts → fetchMaintenanceConfig()
2. Try GET /api/maintenance/config
   ├─ Success: Save to AsyncStorage (MAINTENANCE_CONFIG_KEY)
   └─ Failure: Load from AsyncStorage cache (offline support)
3. Parse schedule, skipReasons, completionStatuses
4. If server returns empty → use FALLBACK constants from maintenanceConstants.js
```

---

## Data Storage

### AsyncStorage Keys

```javascript
// Odometer
KM_KEY = 'odometer_km'

// Per-tricycle maintenance state (last service km per item)
`maintenance_data_${tricycleId}` = { [itemKey]: lastServiceKm }

// Wear patterns for AI (per-tricycle)
`${WEAR_PATTERNS_KEY}_${tricycleId}` = { [itemKey]: [{km, wearLevel, kmSinceLastService, timestamp}] }

// Maintenance history (per-tricycle)
`${MAINTENANCE_HISTORY_KEY}_${tricycleId}` = [{itemKey, km, status, reading, notes, cost, date, approvalStatus}]

// Skip reasons (per-tricycle)
`${SKIP_REASONS_KEY}_${tricycleId}` = { [itemKey]: {reason, timestamp, acknowledgedOverdue} }

// Notified items (prevents duplicate notifications)
`${NOTIFIED_ITEMS_KEY}_${tricycleId}` = { [`${itemKey}_${type}`]: notificationId }

// Scheduled notifications
SCHEDULED_NOTIFICATIONS_KEY = 'maintenance_scheduled_notifications'

// Ride diagnostics (from RideExperienceSurvey)
RIDE_DIAGNOSTIC_KEY = 'rideExperienceSurveyData'

// Server config cache
MAINTENANCE_CONFIG_KEY = 'maintenance_config_cache'
```

### Data Merge Strategy

```
Server History → Filter (approvalStatus === 'approved' || legacy)
                        ↓
Local Cache ───────────→ Merge (prefer max KM value)
                        ↓
                   Final State (data)
```

---

## Maintenance Items

### Item Structure

Each maintenance item tracked:

```javascript
{
  key: 'engine_oil',           // Unique identifier
  name: 'Engine Oil',          // Display name
  category: 'powertrain',      // Category for grouping
  interval: 4000,              // Base KM interval
  criticalThreshold: 0.85,     // AI: wear % to trigger alert
  safetyWeight: 1.3,           // AI: multiplier for safety priority
  timeDecayType: 'time_sensitive', // How time affects wear
  maxDaysInterval: 90,         // Max days without service
}
```

### Time Decay Types

| Type | Behavior | Examples |
|------|----------|----------|
| `time_sensitive` | Degrades even when idle | engine_oil, battery_water, brake_fluid |
| `usage_based` | Only wears with riding | chain, clutch, spark_plug |
| `hybrid` | Partial time sensitivity | brake_pads, cables |

---

## Notification System

### Channels

```javascript
// Critical alerts (high priority, sound)
'maintenance' → Used for critical/worn items

// Scheduled reminders (normal priority)
'maintenance-reminders' → Daily/weekly scheduled checks
```

### Notification Types

1. **Critical Item Notifications** (immediate)
   - Triggered when `wearPercent >= criticalThreshold * 100`
   - One-time: tracked in `notifiedItems` to prevent spam

2. **Worn Item Notifications** (immediate)
   - Triggered when `wearPercent >= 85% && < critical`
   - Same deduplication as critical

3. **Overdue Notifications** (batch check)
   - Runs weekly or on app open
   - Groups all overdue items into single alert

4. **Scheduled Reminders** (background)
   - Uses `expo-notifications` scheduling
   - Saved to `SCHEDULED_NOTIFICATIONS_KEY`

### Deduplication Logic

```javascript
// Key format: `${itemKey}_${notificationType}`
const notifyKey = `${itemKey}_critical`;

if (!notifiedItems[notifyKey]) {
  // Send notification
  await Notifications.scheduleNotificationAsync({...});
  
  // Mark as notified
  notifiedItems[notifyKey] = notificationId;
  await AsyncStorage.setItem(NOTIFIED_ITEMS_KEY, JSON.stringify(notifiedItems));
}
```

---

## Predictive AI Engine

### Overview

`PredictiveMaintenance.jsx` provides intelligent wear predictions using:
- Linear regression on wear history
- Adaptive intervals based on driving patterns
- Ride diagnostic integration
- Time decay calculations

### Prediction Formula

```
1. Collect wear history points: [{km, wearLevel}]
2. Run linear regression → slope, intercept, R²
3. Predict kmToFailure = (criticalThreshold * 100 - intercept) / slope
4. Apply modifiers:
   - timeFactor (time decay)
   - diagnosticFactor (symptom severity)
   - safetyWeight (safety margin)
5. Calculate confidence (40-97%)
```

### Confidence Scoring

```
Base: R² * 50                    (up to 50 points)
Data quantity: dataPoints * 2.5  (up to 25 points)
Consistency bonus: CV factor     (up to 15 points)
Date info bonus: +5
Diagnostic data: +12 max
Safety penalty: cap at 85% for safety items
```

### Idle Vehicle Detection

```javascript
// Vehicle is idle if:
actualDailyKm < 5 && daysSinceService >= 7

// Behavior when idle:
- time_sensitive: Still degrades (fluids oxidize, battery discharges)
- usage_based: No time pressure (timeFactor = 1.0)
- hybrid: 30% of normal time pressure
```

### Ride Diagnostic Integration

```javascript
// From RideExperienceSurvey (symptom reporting)
rideDiagnosticData = {
  symptomSeverity: 0-5,  // How bad the issue is
  trend: 'stable' | 'worsening' | 'improving',
  occurrences: Number,   // Times flagged
}

// Diagnostic factor calculation:
if (symptomSeverity >= 2) {
  diagnosticFactor = 1 + (symptomSeverity - 1) * 0.15;
}
if (trend === 'worsening') diagnosticFactor *= 1.2;
if (occurrences >= 3) diagnosticFactor *= 1.15;
diagnosticFactor = Math.min(2.0, diagnosticFactor);

// Accelerates prediction: predictedKm /= diagnosticFactor
```

---

## Completion Workflow

### Flow Diagram

```
User taps item → openCompletionModal()
      ↓
CompletionModal renders:
  - Status dropdown (completed, replaced, repaired, adjusted, inspected)
  - Reading input (item-specific options from READING_OPTIONS_BY_KEY)
  - Notes text field
  - Cost input
  - Proof image picker
  - Date picker (defaults to now)
      ↓
handleSubmitCompletion()
      ↓
saveToServer() → POST /api/maintenance/tricycle/:id/log
      ↓
Response: { approvalStatus: 'pending' | 'approved' }
      ↓
If approved OR offline:
  - Update data state (last service km)
  - Save to AsyncStorage
  - Track wear pattern for AI
  - Update lastServiceDates
  - Clear skip reason (if any)
  - Clear notification flag
      ↓
Show confirmation alert
```

### Reading Options

Item-specific dropdown options in `maintenanceConstants.js`:

```javascript
READING_OPTIONS_BY_KEY = {
  tire_pressure: ['Low (< 25 PSI)', 'Normal (25-35 PSI)', 'High (> 35 PSI)', ...],
  chain: ['Very Loose (> 2" play)', 'Loose (1-2" play)', 'Normal (0.5-1" play)', ...],
  battery_water: ['Empty', 'Low (below minimum)', 'Normal', 'Full (at maximum)'],
  engine_oil: ['Empty/Dry', 'Very Low (below minimum)', ..., 'Overfilled (above maximum)'],
  // ... more items
}
```

---

## Skip/Defer Workflow

### Skip Reasons

Server provides configurable skip reasons:

```javascript
DEFAULT_SKIP_REASONS = [
  { id: 'will_service_soon', label: 'Will service soon', icon: '🔧' },
  { id: 'no_budget', label: 'Budget constraints', icon: '💰' },
  { id: 'parts_unavailable', label: 'Parts unavailable', icon: '📦' },
  { id: 'scheduled_for_later', label: 'Scheduled for later', icon: '📅' },
  { id: 'different_mechanic', label: 'Different mechanic visit', icon: '👨‍🔧' },
  { id: 'monitoring', label: 'Currently monitoring', icon: '👁' },
]
```

### Skip Logic

```javascript
handleSkip(itemKey, reason) {
  // Save skip reason with timestamp
  skipReasons[itemKey] = {
    reason: reason.label,
    reasonId: reason.id,
    timestamp: Date.now(),
    acknowledgedOverdue: true,
  };
  
  // Persist to AsyncStorage
  await AsyncStorage.setItem(SKIP_REASONS_KEY, JSON.stringify(skipReasons));
  
  // Clear notification flag (stops repeated alerts)
  delete notifiedItems[`${itemKey}_critical`];
  delete notifiedItems[`${itemKey}_worn`];
}
```

---

## Overdue Detection

### Detection Logic

```javascript
isOverdue(item, group) {
  const lastKm = data[item.key] || 0;
  const kmSinceService = currentKm - lastKm;
  
  // KM-based check
  if (kmSinceService > group.intervalKm) return true;
  
  // Time-based check
  const lastDate = lastServiceDates[item.key];
  if (lastDate) {
    const daysSince = (Date.now() - new Date(lastDate)) / (1000 * 60 * 60 * 24);
    if (daysSince > group.intervalDays) return true;
  }
  
  return false;
}
```

### Overdue Check Modal

- Shows on app open if overdue items exist (and not skipped)
- Lists all overdue items with severity indicator
- Actions per item:
  - **Complete Now** → Opens CompletionModal
  - **Skip** → Opens SkipReasonModal
  - **Remind Later** → Sets 24hr reminder

---

## Approval Workflow

### Driver submits maintenance:

```
POST /api/maintenance/tricycle/:id/log
Body: {
  itemKey, lastServiceKm, notes, status, reading, cost, completedAt, proofImage
}
Response: { approvalStatus: 'pending' }
```

### Operator approval flow:

1. Operator sees pending logs in dashboard
2. Reviews proof image, reading, notes
3. Approves or rejects
4. `PATCH /api/maintenance/tricycle/:id/log/:logId`
5. If approved → syncs to device on next fetch

### Client handling:

```javascript
// Only approved records update local state
serverHistory.filter(log => log.approvalStatus === 'approved' || !log.approvalStatus)

// Pending shows "⏳ Pending operator approval" message
if (approvalStatus === 'pending') {
  Alert.alert('Maintenance Submitted ⏳', 'Pending operator approval...');
}
```

---

## Component Relationships

```
MaintenanceTracker.jsx (main container)
├── Tab: 'schedule'
│   └── MaintenanceScheduleList.jsx
│       └── Item rows → tap → CompletionModal.jsx
│                     → hold → SkipReasonModal.jsx
├── Tab: 'history'
│   └── ServiceHistory.jsx (timeline view)
└── Tab: 'checkup'
    ├── VehicleDiagnostic.jsx (SVG visual)
    ├── PredictiveMaintenance.jsx (AI predictions)
    └── RideExperienceSurvey.jsx (symptom survey)

OverdueCheckModal.jsx (popup on app open)
OdometerModal.jsx (manual km input)
```

---

## Server API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/maintenance/config` | Fetch schedule groups, skip reasons, statuses |
| GET | `/api/maintenance/tricycle/:id/logs` | Get maintenance history for tricycle |
| POST | `/api/maintenance/tricycle/:id/log` | Submit new maintenance log |
| GET | `/api/maintenance/tricycle/:id/log/:logId` | Get single log details |
| PATCH | `/api/maintenance/tricycle/:id/log/:logId` | Update/approve log |
| DELETE | `/api/maintenance/tricycle/:id/log/:logId` | Delete log |
| POST | `/api/maintenance/proof-image` | Upload proof image (base64 → file) |

---

## Key State Variables

### MaintenanceTracker.jsx

```javascript
// Odometer
currentKm: string          // Stored value
odometerKm: number         // Polling value (live)

// Maintenance state
data: { [itemKey]: lastServiceKm }
lastServiceDates: { [itemKey]: ISOString }
skipReasons: { [itemKey]: { reason, timestamp, acknowledgedOverdue } }
maintenanceRecords: { [itemKey]: [record, record, ...] }

// Config (from server)
maintenanceSchedule: [{ id, title, intervalDays, intervalKm, items: [...] }]
skipReasonOptions: [{ id, label, icon }]
completionStatusOptions: [{ id, label, icon }]

// AI
wearPatterns: { [itemKey]: [{ km, wearLevel, timestamp }] }
rideDiagnosticMap: { [itemKey]: { symptomSeverity, trend, occurrences } }

// Notifications
notifiedItems: { [`${itemKey}_${type}`]: notificationId }

// UI
activeTab: 'schedule' | 'history' | 'checkup'
completionModalVisible, completionItem
overdueCheckModalVisible, overdueItems
```

---

## Wear Pattern Tracking

### Data Collection

```javascript
trackWearPattern(itemKey, currentKm, previousServiceKm) {
  const kmSinceService = currentKm - previousServiceKm;
  const expectedInterval = group.intervalKm;
  const wearLevel = Math.min(100, (kmSinceService / expectedInterval) * 100);
  
  wearPatterns[itemKey].push({
    km: currentKm,
    wearLevel,
    kmSinceLastService: kmSinceService,
    timestamp: Date.now(),
  });
  
  // Keep last 20 data points per item
  if (wearPatterns[itemKey].length > 20) {
    wearPatterns[itemKey] = wearPatterns[itemKey].slice(-20);
  }
  
  await AsyncStorage.setItem(WEAR_PATTERNS_KEY, JSON.stringify(wearPatterns));
}
```

### AI Consumption

PredictiveMaintenance uses wear patterns to:
1. Calculate regression slope (wear rate)
2. Detect anomalies (slope > expected * 1.5)
3. Adapt interval recommendations
4. Build confidence scores

---

## Error Handling

### Offline Support

- Config: Falls back to AsyncStorage cache
- Submissions: Marked pending locally, sync on reconnect
- Odometer: Polls AsyncStorage (updated by GPS tracking)

### Validation

- KM must be positive integer
- Reading must be from allowed options
- Proof image converted to base64 before upload
- Date cannot be future

---

## Future Enhancements (TODO)

1. Background sync for pending records
2. Push notification when approval status changes
3. Mechanic shop locator integration
4. Parts price estimation
5. Multi-vehicle fleet dashboard
