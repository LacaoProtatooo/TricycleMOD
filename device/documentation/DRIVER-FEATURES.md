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
