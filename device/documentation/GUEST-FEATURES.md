# Guest Features Documentation

## Overview
Guest users are unauthenticated or users with minimal privileges. They can access basic features without logging in, ideal for passengers wanting to book rides or explore the app before registering.

---

## Tab Navigation

Guests have access to a bottom tab navigator with the following tabs:

### 1. Booking (Special Trips)
**Location:** [src/screens/guest/BookingScreen.jsx](../src/screens/guest/BookingScreen.jsx)

The main feature for guests to request tricycle rides.

**Features:**
- **Location-based booking**: Get current GPS location for pickup
- **Set pickup & destination**: Tap on map or search addresses
- **Service area validation**: Ensures locations are within WEBTTODA service area (GPX-based polygon)
- **Fare estimation**: Automatic route calculation with suggested fare based on distance
- **Preferred fare input**: Set your own fare amount
- **Multiple driver offers**: Receive and compare offers from multiple nearby drivers
- **Real-time trip tracking**: Track driver location during active trips
- **Trip completion**: Confirm trip completion and rate driver
- **Trip history**: View past bookings and their details

**Booking Status Flow:**
1. `IDLE` → Select locations
2. `SELECTING_LOCATIONS` → Set pickup and destination
3. `SETTING_FARE` → Enter preferred fare
4. `WAITING_FOR_DRIVER` → Wait for driver offers
5. `OFFERS_RECEIVED` → Review and accept an offer
6. `TRIP_ACTIVE` → Trip in progress
7. `AWAITING_CONFIRMATION` → Driver marks trip complete
8. `TRIP_COMPLETED` → Confirm and rate

**Business Rules:**
- One active booking per user at a time
- Pickup must be within service area
- Destination can be outside (with warning)
- Drivers within radius are notified via FCM push

---

### 2. Queue Viewer
**Location:** [src/screens/guest/QueueScreen.jsx](../src/screens/guest/QueueScreen.jsx)

View the current driver queue at each terminal.

**Features:**
- **Terminal selection**: Choose from available terminals
- **Real-time queue display**: See drivers waiting in line
- **Auto-refresh**: Updates every 10 seconds
- **Driver count**: Shows how many tricycles are waiting
- **Estimated wait time**: Based on queue position

**Usage:**
- Helps passengers know which terminal has available drivers
- No authentication required
- Pull-to-refresh for manual updates

---

### 3. Weather
**Location:** [src/screens/guest/weather.jsx](../src/screens/guest/weather.jsx)

Weather information for Taguig City.

**Features:**
- **Current conditions**: Temperature, humidity, wind
- **Hourly forecast**: Next 6 hours forecast
- **Weather advisories**: Automatic modal alerts for:
  - Rain warnings
  - Extreme heat (>31°C threshold)
  - Storm alerts
- **Relevant for commuters**: Plan trips based on weather

**Components:**
- Uses `WeatherWidget` component for display
- `WeatherAdvisoryModal` for automatic warnings

---

### 4. Maps
**Location:** [src/screens/guest/maps.jsx](../src/screens/guest/maps.jsx)

Interactive map showing the WEBTTODA service area.

**Features:**
- **Service area visualization**: View the coverage zone
- **Route display**: See the official WEBTTODA route
- **Landmarks/terminals**: Key points of interest
- **Map interaction**: Pinch to zoom, drag to pan

---

### 5. Tracking (GPS Trip Recording)
**Location:** [src/screens/guest/tracking.jsx](../src/screens/guest/tracking.jsx)

Full-featured GPS tracking and trip recording system.

**Features:**
- **Real-time GPS tracking**:
  - Current speed (km/h)
  - Altitude
  - Heading/direction
  - Coordinates display

- **Trip recording**:
  - Start/stop recording
  - Local buffer storage
  - Auto-sync to MongoDB server
  - GPX export capability

- **Trip history**:
  - View past recorded trips
  - Relive playback with animation
  - Distance and duration stats
  - Share trip data

- **GPX import**:
  - Import external GPX files
  - Parse and display tracks

- **Device identification**:
  - Unique device ID generation
  - Cross-device trip sync

**Storage:**
- Local: AsyncStorage for active trips
- Server: MongoDB for completed trips
- Cloud: Cloudinary for GPX file exports

---

### 6. Complaints
**Location:** [src/screens/guest/ComplaintScreen.jsx](../src/screens/guest/ComplaintScreen.jsx)

File complaints against drivers.

> **Note:** Requires authentication. Guests will be prompted to log in.

**Features (when authenticated):**
- **Complaint filing**:
  - Select category
  - Describe incident
  - Upload photo/video evidence (required)
  - Select driver or enter tricycle details
  - Link to recent booking (optional)

- **Body number OCR scanning**:
  - Scan tricycle body number from photo
  - Auto-fill driver information

- **Sentiment analysis**:
  - AI-powered description analysis
  - Helps prioritize complaints

- **Rate limiting**:
  - Anti-abuse measures
  - Credibility scoring

- **Complaint history**:
  - View submitted complaints
  - Track status (pending, investigating, resolved)

---

## Drawer Navigation

Guests have limited drawer options:

| Item | Description |
|------|-------------|
| Login | Navigate to login screen |
| Signup | Navigate to registration screen |
| About | App information and WEBTTODA details |

---

## Authentication Flow

### From Guest to Authenticated User

1. Guest uses the app freely
2. When a protected feature is accessed (e.g., filing complaint, booking)
3. Authentication check occurs
4. If not authenticated, shown login prompt
5. After login, feature becomes available

### Login Options
- **Email/Password**: Traditional login
- **Google Sign-In**: OAuth integration

---

## Technical Details

### State Management
- Redux store for global state
- AsyncStorage for local persistence
- No JWT token (unauthenticated)

### Location Services
- `expo-location` for GPS
- Foreground permissions required for booking
- Background tracking for trip recording

### Push Notifications
- Not available for guests
- Becomes available after authentication

---

## Limitations

| Feature | Guest Access |
|---------|-------------|
| Booking creation | ✅ (requires auth at confirmation) |
| View queue | ✅ |
| Weather | ✅ |
| Maps | ✅ |
| GPS Tracking | ✅ |
| File complaints | ❌ (auth required) |
| Messages | ❌ |
| Forum | ❌ |
| Lost & Found posting | ❌ |
| Notifications | ❌ |

---

## Related Files

- Navigation: [src/screens/guest/main.jsx](../src/screens/guest/main.jsx)
- Theme: [src/components/common/theme.js](../src/components/common/theme.js)
- Config: [src/utils/config.js](../src/utils/config.js)
- Route Service: [src/utils/routeService.js](../src/utils/routeService.js)
- GPX Parser: [src/utils/gpxParser.js](../src/utils/gpxParser.js)
