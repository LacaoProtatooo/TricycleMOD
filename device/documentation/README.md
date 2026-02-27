# WEBTTRaC Mobile App Documentation

## Overview

**WEBTTRaC** (WEBTTODA Tricycle Ride and Compliance) is a React Native mobile application for the WEBTTODA (Western Bicutan Tricycle Operators and Drivers Association). The app serves three distinct user roles with tailored features for each.

---

## User Roles

| Role | Description | Documentation |
|------|-------------|---------------|
| **Guest** | Unauthenticated users or passengers | [GUEST-FEATURES.md](./GUEST-FEATURES.md) |
| **Driver** | Tricycle drivers who accept rides | [DRIVER-FEATURES.md](./DRIVER-FEATURES.md) |
| **Operator** | Fleet managers who own tricycles | [OPERATOR-FEATURES.md](./OPERATOR-FEATURES.md) |
| **Common** | Shared features for authenticated users | [COMMON-FEATURES.md](./COMMON-FEATURES.md) |

---

## Quick Feature Matrix

| Feature | Guest | Driver | Operator |
|---------|:-----:|:------:|:--------:|
| Book a ride | ✅ | ❌ | ❌ |
| View queue | ✅ | ✅ | ✅ |
| Weather info | ✅ | ✅ | ✅ |
| Maps/Service area | ✅ | ✅ | ✅ |
| GPS trip recording | ✅ | ✅ | ❌ |
| File complaints | 🔐 | ✅ | ✅ |
| Accept bookings | ❌ | ✅ | ❌ |
| Leaderboard | ❌ | ✅ | ❌ |
| Maintenance tracking | ❌ | ✅ | 🔍 |
| Sick leave request | ❌ | ✅ | ❌ |
| Forum | ❌ | ✅ | ✅ |
| Lost & Found | ❌ | ✅ | ✅ |
| Messages | ❌ | ✅ | ✅ |
| Manage tricycles | ❌ | ❌ | ✅ |
| Manage drivers | ❌ | ❌ | ✅ |
| Approve sick leave | ❌ | ❌ | ✅ |
| Boundary settlements | ❌ | ❌ | ✅ |
| Approve maintenance | ❌ | ❌ | ✅ |

Legend: ✅ Full access | 🔐 Requires login | 🔍 Review only | ❌ Not available

---

## Tech Stack

| Technology | Purpose |
|------------|---------|
| React Native 0.81.5 | Cross-platform mobile framework |
| Expo 54 | Development and build tooling |
| Redux Toolkit | State management |
| React Navigation 7 | Screen navigation |
| expo-location | GPS and location services |
| expo-notifications | Push notifications |
| react-native-maps | Map display |
| expo-sqlite | Local database for JWT |
| Firebase | Authentication & FCM |
| Axios | HTTP client |

---

## Project Structure

```
device/
├── App.js                 # Root component
├── src/
│   ├── components/
│   │   ├── booking/       # Booking-related components
│   │   ├── common/        # Shared UI components
│   │   ├── forum/         # Forum components
│   │   ├── home/          # Dashboard components
│   │   └── services/      # Background services
│   ├── context/
│   │   ├── BookingContext.jsx
│   │   └── SweetAlertContext.jsx
│   ├── navigation/
│   │   └── navigator.jsx  # Main navigation config
│   ├── redux/
│   │   ├── store.js
│   │   ├── actions/       # Redux action creators
│   │   └── reducers/      # Redux reducers
│   ├── screens/
│   │   ├── common/        # Shared screens
│   │   ├── dashboard/     # Driver dashboard tabs
│   │   ├── driver/        # Driver-specific screens
│   │   ├── guest/         # Guest screens
│   │   ├── message/       # Chat screens
│   │   └── operator/      # Operator screens
│   └── utils/             # Utility functions
└── documentation/         # This folder
```

---

## Key Features by Module

### Booking System
- Special trip requests (guest/passenger initiated)
- Multi-driver offer system
- Real-time fare negotiation
- GPS-based pickup/destination
- Service area validation (GPX polygon)
- Trip completion and rating

### Queue Management
- Terminal-based FIFO queue
- Real-time queue updates
- Geofence detection for terminals
- Auto-leave when exiting zone

### GPS Tracking
- Real-time location tracking
- Trip recording with playback
- GPX import/export
- Background location updates
- Odometer accumulation

### Maintenance System
- Predictive maintenance scheduling
- Service history logging
- Operator approval workflow
- Push reminders for due services
- Photo proof requirements

### Communication
- In-app messaging
- Push notifications (FCM)
- Announcements system
- Weather advisories

### Compliance
- Rules & regulations display
- Violation tracking (admin side)
- Complaint system with evidence
- Coding day enforcement

---

## Authentication Flow

```
┌─────────────┐
│   Guest     │───→ Limited features
└─────────────┘
       │
       │ Login/Signup
       ▼
┌─────────────┐
│ Authenticated│
└─────────────┘
       │
       ├──→ role: 'guest'   → Enhanced guest features
       │
       ├──→ role: 'driver'  → Full driver features
       │
       └──→ role: 'operator'→ Fleet management
```

---

## API Endpoints (Backend)

The mobile app connects to these main API routes:

| Route | Purpose |
|-------|---------|
| `/api/auth` | Authentication |
| `/api/booking` | Ride bookings |
| `/api/queue` | Terminal queue |
| `/api/tracking` | GPS records |
| `/api/tricycles` | Vehicle data |
| `/api/operator` | Fleet management |
| `/api/sick-leave` | Leave requests |
| `/api/maintenance` | Service records |
| `/api/forum` | Discussion board |
| `/api/lost-found` | Lost items |
| `/api/complaints` | Complaint filing |
| `/api/announcements` | Broadcast messages |
| `/api/messages` | In-app chat |
| `/api/boundary` | Fare settlements |
| `/api/leaderboard` | Driver rankings |

---

## Environment Configuration

**Location:** [src/utils/config.js](../src/utils/config.js)

```javascript
export const API_URL = 'http://your-server.com';
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- Expo CLI
- Android Studio (for Android)
- Xcode (for iOS, macOS only)

### Installation
```bash
cd device
npm install
```

### Development
```bash
npx expo start
```

### Build
```bash
# Android
eas build --platform android

# iOS
eas build --platform ios
```

---

## Related Documentation

- **Server API**: See `/server/README.md`
- **Web Dashboard**: See `/web/README.md`
- **Database Models**: See `/server/models/`

---

## Support

For issues or feature requests, contact WEBTTODA administration or submit through the in-app feedback system.
