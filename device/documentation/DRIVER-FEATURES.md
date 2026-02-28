# Driver Features Documentation

## Overview
Drivers are authenticated users with the role `driver`. They are tricycle operators who accept ride bookings, manage their daily operations, and interact with passengers and the WEBTTODA system.

---

## Home Screen Navigation

Drivers have a bottom tab navigator with the following tabs:

### 1. Dashboard
**Location:** [src/screens/dashboard/DashboardTab.jsx](../src/screens/dashboard/DashboardTab.jsx)

The main overview screen for drivers.

**Features:**

#### Personal Greeting
- Displays driver's name
- Profile avatar
- Assigned tricycle information (plate number)

#### Coding Day Status
- **What is Coding Day?** MMDA-style number coding restriction
- Visual indicator showing:
  - If today is coding day (red warning, cannot operate)
  - Reminder if coding day is tomorrow (yellow warning)
  - Hours remaining until coding ends
- **Restrictions when active:**
  - Cannot go online
  - Cannot join queue
  - Cannot accept bookings

#### Weather Widget
- Current weather conditions
- Hourly forecast
- Helps plan daily operations

#### Maintenance Tracker
**Location:** [src/components/home/MaintenanceTracker.jsx](../src/components/home/MaintenanceTracker.jsx)

Advanced vehicle maintenance system:

**Features:**
- **Odometer tracking**: Current vehicle mileage
- **Maintenance schedule**: Configurable service intervals
- **Due/overdue alerts**: Push notifications for upcoming service
- **Service history**: Log of all maintenance performed
- **Skip/defer option**: Postpone with reason
- **Completion logging**: Record service with:
  - Status (completed, parts replaced)
  - Cost
  - Notes
  - Photo proof

**Tabs within Maintenance:**
1. **Schedule**: Upcoming maintenance items
2. **History**: Past service records
3. **Checkup**: Vehicle diagnostic survey

**Predictive Maintenance:**
- AI-powered service predictions
- Anomaly detection
- Health score calculation
- Wear pattern analysis

---

### 2. Trips (Booking Management)
**Location:** [src/screens/dashboard/TripsTab.jsx](../src/screens/dashboard/TripsTab.jsx)

Manage ride bookings and offers.

**Features:**

#### Online/Offline Toggle
- Control availability status
- Disabled during coding day
- Disabled if no tricycle assigned

#### Nearby Booking Requests
- List of available booking requests
- Shows:
  - Passenger name and rating
  - Pickup location
  - Destination
  - Preferred fare
  - Distance from driver

#### Actions on Bookings
- **Accept at offered fare**: Agree to passenger's price
- **Send counter offer**: Propose different fare with message
- **Decline**: Skip this booking

#### Pending Offers
- Offers you've sent awaiting passenger response
- Withdraw offer option

#### Active Trip Card
- Current booking in progress
- Passenger details
- Quick actions:
  - Navigate to maps
  - Cancel trip

#### Booking Context
**Location:** [src/context/BookingContext.jsx](../src/context/BookingContext.jsx)

Shared state between Trips and Maps tabs:
- Active booking data
- Trip status (pickup, in-progress)
- Distance calculations
- Driver arrival status

---

### 3. Leaderboard (Ranks)
**Location:** [src/screens/dashboard/LeaderboardTab.jsx](../src/screens/dashboard/LeaderboardTab.jsx)

Competitive driver rankings.

**Features:**

#### View Modes
- **Monthly leaderboard**: Current month rankings
- **All-time leaderboard**: Lifetime statistics

#### Month Selector
- Browse historical months
- Compare performance over time

#### Your Rank
- Current position highlighted
- Trip count and rating

#### Ranking Criteria
- Total trips completed
- Average rating
- Loyalty months

#### Visual Indicators
- 🏆 Gold trophy for #1
- 🥈 Silver medal for #2
- 🥉 Bronze medal for #3

---

### 4. Maps (Tracking & Navigation)
**Location:** [src/screens/dashboard/MapsTab.jsx](../src/screens/dashboard/MapsTab.jsx)

Full-featured map with GPS tracking.

**Features:**

#### Tracking Map Component
**Location:** [src/components/home/TrackingMap.jsx](../src/components/home/TrackingMap.jsx)

- **Real-time location tracking**
- **Odometer accumulation**: Distance traveled
- **Stay mounted across tabs**: Preserves tracking state
- **Route visualization**: Active trip route display

#### Coding Day Banner
- Warning when operating restrictions apply
- Hours until restriction lifts

#### Queue Integration
**Location:** [src/components/home/QueueCard.jsx](../src/components/home/QueueCard.jsx)

- **Terminal zones**: Detected when entering terminal area
- **Join queue**: Add yourself to terminal queue
- **Queue position**: Your current place in line
- **Auto-leave**: Removed when leaving terminal zone
- **First in queue notification**: Alert when you're next

#### Active Trip Overlay
**Location:** [src/components/booking/ActiveTripOverlay.jsx](../src/components/booking/ActiveTripOverlay.jsx)

When booking is active:
- **Distance to pickup/destination**
- **Mark arrived**: Indicate arrival at pickup
- **Confirm pickup**: Passenger is in vehicle
- **Complete trip**: End the journey
- **No-show handling**: Wait timer + mark passenger absent
- **Cancel trip**: Emergency cancellation

#### DEV-Only: Simulation Testing (`__DEV__` builds only)

A complete trip simulation system for development and testing. All features are guarded behind `__DEV__` and are stripped from production builds.

##### How It Works

The simulation lets you complete an entire booking trip while **staying stationary**. Your icon moves along the booking route on the map, GPS data is recorded for relive/history, and all pickup/arrival/destination distance checks are bypassed.

##### Step-by-Step Flow

1. **Accept a booking** in the Trips tab as normal
2. **Bypass arrival & pickup** — In `__DEV__` builds, the Active Trip Overlay buttons bypass distance checks:
   - **"I've Arrived (DEV)"** — Marks arrival at pickup without being within 100m (sends `devBypass` to server)
   - **"Confirm Pickup (DEV)"** — Starts the trip (`in_progress`) without being within 50m of pickup
   - **"Complete Trip (DEV)"** — Completes the trip without being within 300m of destination
   - A purple banner shows: "DEV mode — distance checks bypassed"
3. **Switch to Maps tab** — After pickup is confirmed, the route is loaded
4. **Tap "DEV Simulate Route"** — Starts the simulation along the booking route
5. **Icon moves along route** — The Waze-style arrow follows the simulated path; the native blue dot is hidden during simulation
6. **Speed controls (+/−)** — Adjust simulation speed: `0.5x`, `1x`, `2x`, `4x`, `8x`, `16x`
7. **Pause/Stop** — Pause the simulation or stop it entirely
8. **Sim reaches destination** — When 100% complete, the "Complete Trip" button in the Trips tab overlay is enabled
9. **Complete the trip** — Tap Complete Trip to finish the booking

##### Key Files

| File | Purpose |
|------|---------|
| [src/components/home/TrackingMap.jsx](../src/components/home/TrackingMap.jsx) | Simulation engine, icon movement, speed controls, route interpolation |
| [src/components/booking/ActiveTripOverlay.jsx](../src/components/booking/ActiveTripOverlay.jsx) | Distance-check bypass for arrival, pickup, completion |
| [src/context/BookingContext.jsx](../src/context/BookingContext.jsx) | `markDriverArrived` accepts `{ devBypass: true }` option |
| [src/screens/dashboard/DriverBookingScreen.jsx](../src/screens/dashboard/DriverBookingScreen.jsx) | DEV sim panel with step-by-step bypass buttons |
| Server: `controllers/bookingController.js` | `driverArrived` and `completeTrip` endpoints accept `devBypass` body param |

##### Simulation Engine (TrackingMap)

- **Route source**: Uses the actual booking route from Google Directions API (`bookingRoute` prop)
- **Interpolation**: Each segment is split into 10 sub-points for smooth movement
- **Position recording**: Sim loop directly records to `recordedPosRef` (for server sync) and `positions` (for polyline + relive)
- **GPS isolation**: Real GPS watcher skips positions/odometer/speed while `simActiveRef` is true, preventing spaghetti polylines
- **Camera follow**: Poll listener reads `SIM_BROADCAST_KEY` from AsyncStorage and updates the Waze-style navigation camera
- **Icon display**: `showsUserLocation={!simActive}` hides the native blue dot during sim, showing only the Waze arrow at the sim position
- **Heading updates**: Sim heading is forwarded to the arrow marker via `setHeading()` in the poll listener
- **Screen awake**: `expo-keep-awake` prevents screen sleep during simulation
- **Sim completion**: When sim finishes naturally, `simActive` stays true so the icon remains at the destination; `reachedDestination` flag is written to AsyncStorage for the bypass button
- **Cleanup**: `stopDevSimulation` or booking cancellation clears all sim state

##### Speed Controls

| Speed | Effect |
|-------|--------|
| 0.5x | Half speed (slow motion) |
| 1x | Real-time (~29 km/h tricycle speed) |
| 2x | Double speed |
| 4x | 4× speed |
| 8x | 8× speed |
| 16x | 16× speed (fastest) |

Speed changes take effect immediately on the next interpolation point via `devSimSpeedRef`.

##### 3D Relive

After a simulated trip, the 3D Relive feature works normally because all positions are recorded directly during simulation. The relive has its own speed controls: `1x`, `2x`, `4x`, `8x`, `16x`.

##### Inter-Component Communication

The simulation uses `AsyncStorage` with key `dev_sim_broadcast_v1` to share state between components:

```json
{
  "isActive": true,
  "latitude": 14.xxxx,
  "longitude": 121.xxxx,
  "heading": 45,
  "speed": 8.2,
  "reachedDestination": false
}
```

- **TrackingMap** writes this on every sim tick
- **ActiveTripOverlay** polls it to detect active sim
- **DriverBookingScreen** polls it for the `reachedDestination` flag

---

### 5. Messages
**Location:** [src/screens/message/chatMenu.jsx](../src/screens/message/chatMenu.jsx)

In-app messaging system.

**Features:**
- **Conversation list**: All message threads
- **Real-time chat**: Direct messaging
- **Message notifications**: Push alerts for new messages
- **Chat with**:
  - Passengers (from bookings)
  - Operators
  - Other drivers

---

## Drawer Navigation

Drivers have access to these drawer items:

| Item | Description |
|------|-------------|
| Home | Return to main dashboard |
| Account | Profile management |
| Forum | Community discussions |
| Notifications | Inbox for push notifications |
| Sick Leave | Request time off |
| About | App information |
| Lost & Found | Post/browse lost items |
| Rules & Regulations | WEBTTODA policies |

---

## Driver-Specific Features

### Sick Leave Management
**Location:** [src/screens/common/SickLeaveScreen.jsx](../src/screens/common/SickLeaveScreen.jsx)

Request time off from operating.

**Features:**
- **Date selection**: Start and end dates (calendar picker)
- **Reason input**: Describe illness/situation
- **Medical certificate**: Upload supporting document (image)
- **Emergency contact**: Optional contact information
- **Request history**: View past requests with status
- **Statistics**: Days used, remaining, etc.

**Status Types:**
- `pending`: Awaiting operator approval
- `approved`: Request granted
- `rejected`: Request denied (with reason)
- `cancelled`: Self-cancelled

---

### Account Management
**Location:** [src/screens/common/account.jsx](../src/screens/common/account.jsx)

**Features:**
- **Profile editing**: Name, phone, address
- **Profile photo**: Change avatar image
- **Driver's license**: Upload/update license
  - OCR parsing for automatic field extraction
  - Expiry tracking
  - License number validation

---

### Forum Participation
**Location:** [src/screens/common/ForumScreen.jsx](../src/screens/common/ForumScreen.jsx)

Community discussion board.

**Features:**
- View posts from other drivers/operators
- Create new posts
- Comment on discussions
- Community announcements

---

### Lost & Found
**Location:** [src/screens/common/LostFoundScreen.jsx](../src/screens/common/LostFoundScreen.jsx)

**Features:**
- **Post lost items**: Found in your tricycle
- **Browse items**: Search for claimed losses
- **Mark as claimed**: When owner retrieves
- **Photo attachment**: Visual identification

---

### Rules & Regulations
**Location:** [src/screens/common/RulesRegulationsScreen.jsx](../src/screens/common/RulesRegulationsScreen.jsx)

Official WEBTTODA policies.

**Sections:**
1. Work and Drive Efficiency
2. Act of Dishonesty
3. Act Against Public Policy
4. Moral Conduct
5. Safety Regulations

**Features:**
- Multi-language support (English/Filipino)
- Searchable content
- Penalty reference for violations

---

### Notifications
**Location:** [src/screens/common/notificationInbox.jsx](../src/screens/common/notificationInbox.jsx)

**Types of Notifications:**
- New booking requests
- Offer accepted/declined
- Trip updates
- Announcements
- Maintenance reminders
- Sick leave status
- Complaint updates

---

## Suspension System

**Location:** [src/screens/common/SuspendedScreen.jsx](../src/screens/common/SuspendedScreen.jsx)

When a driver is suspended:

**Restrictions:**
- Cannot access Home screen
- Cannot accept bookings
- Cannot view leaderboard
- Limited drawer navigation

**Visible to Suspended Drivers:**
- Suspension status screen
- Reason for suspension
- Duration remaining
- Appeal information
- Account page (limited)

---

## Push Notifications

Drivers receive FCM push notifications for:

| Event | Priority |
|-------|----------|
| New booking request | High |
| Offer accepted | High |
| Trip started | Normal |
| New message | Normal |
| Announcement | Normal |
| Maintenance due | Normal |
| Sick leave response | Normal |
| Complaint filed | High |

---

## Technical Details

### State Management
- **Redux**: Global state ([src/redux/store.js](../src/redux/store.js))
- **BookingContext**: Trip state shared between tabs
- **AsyncStorage**: Local persistence

### Location Services
- **Foreground**: Required for online status
- **Background**: Trip tracking via `BackgroundLocationTask`

### Booking Flow (Driver Side)
1. `new_booking` push notification received
2. Booking appears in Trips tab
3. Driver accepts or sends counter-offer
4. If accepted, booking moves to active
5. Navigate to Maps for tracking
6. Mark pickup → In progress
7. Complete trip → Rating

### Authentication
- JWT token stored in SQLite
- Auto-refresh on expiry
- Persistent login across app restarts

---

## Related Files

- Navigation: [src/navigation/navigator.jsx](../src/navigation/navigator.jsx)
- Background Task: [src/components/services/BackgroundLocationTask.js](../src/components/services/BackgroundLocationTask.js)
- Auth Actions: [src/redux/actions/authAction.js](../src/redux/actions/authAction.js)
- Booking Actions: [src/redux/actions/bookingAction.js](../src/redux/actions/bookingAction.js)
- User Storage: [src/utils/userStorage.js](../src/utils/userStorage.js)
- JWT Storage: [src/utils/jwtStorage.js](../src/utils/jwtStorage.js)
- Coding Day Utils: [src/utils/codingDayUtils.js](../src/utils/codingDayUtils.js)
