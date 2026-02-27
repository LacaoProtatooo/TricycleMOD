# Common Features Documentation

## Overview
This document covers features that are shared across authenticated users (drivers and operators). These are screens and components accessible from the drawer navigation.

---

## Account Management
**Location:** [src/screens/common/account.jsx](../src/screens/common/account.jsx)

Full profile management for authenticated users.

### Profile Information
- **First name**: Editable
- **Last name**: Editable
- **Email**: Display only (login credential)
- **Phone**: Editable
- **Address**: Street, city, postal code, country

### Profile Photo
- View current avatar
- Change profile picture
- Image picker (camera/gallery)
- Automatic upload to Cloudinary

### Driver's License (Drivers Only)
- Upload license image
- OCR parsing automatically extracts:
  - License number
  - Full name
  - Birthdate
  - Address
  - Sex
  - Blood type
  - Restrictions
  - Expiry date
- Manual field editing
- Expiry tracking

### Actions
- **Save changes**: Update profile
- **Logout**: Sign out and clear session

---

## Forum
**Location:** [src/screens/common/ForumScreen.jsx](../src/screens/common/ForumScreen.jsx)

Community discussion board for WEBTTODA members.

### Features
- **Post list**: All forum posts
- **Create post**: New discussion
- **Comments**: Reply to posts
- **Like/react**: Engage with content

### ForumBoard Component
**Location:** [src/components/forum/ForumBoard.jsx](../src/components/forum/ForumBoard.jsx)

- Real-time updates
- Pull to refresh
- Infinite scroll
- User avatars and names

### Access
- Drivers: Full access
- Operators: Full access
- Suspended drivers: No access

---

## Notifications
**Location:** [src/screens/common/notificationInbox.jsx](../src/screens/common/notificationInbox.jsx)

Centralized notification management.

### Notification Types
| Type | Description |
|------|-------------|
| booking | New ride requests, offers |
| announcement | System announcements |
| maintenance | Service reminders |
| sick_leave | Leave request updates |
| complaint | Complaint status |
| message | New chat messages |
| settlement | Boundary confirmations |

### Features
- **Inbox view**: All notifications
- **Unread count**: Badge indicator
- **Mark as read**: Individual or bulk
- **Detail view**: Full notification content
- **Deep linking**: Navigate to related screen

### Notification Detail
**Location:** [src/screens/common/notificationDetail.jsx](../src/screens/common/notificationDetail.jsx)

- Full message display
- Action buttons
- Related data

---

## Lost & Found
**Location:** [src/screens/common/LostFoundScreen.jsx](../src/screens/common/LostFoundScreen.jsx)

Community board for lost/found items.

### Features
- **Post an item**:
  - Title
  - Description
  - Location found
  - Photo attachment
  
- **Browse items**:
  - List of posted items
  - Filter by status
  - Search functionality

- **Item management**:
  - Mark as claimed
  - Delete own posts
  - Contact poster

### Use Cases
- Driver finds item left in tricycle
- Passenger lost something during ride
- Community item recovery

---

## Sick Leave (Drivers Only)
**Location:** [src/screens/common/SickLeaveScreen.jsx](../src/screens/common/SickLeaveScreen.jsx)

Request time off from operating.

### Create Request
- **Date range**: Calendar picker for start/end
- **Reason**: Text description
- **Medical certificate**: Image upload (optional)
- **Emergency contact**: Name, phone, relationship

### Request History
- All past requests
- Status indicator (pending, approved, rejected, cancelled)
- Filter by status

### Statistics
- Total days requested
- Days approved this year
- Pending requests

### Status Flow
```
New Request → Pending → Approved/Rejected
                ↓
            Cancelled (self)
```

---

## Rules & Regulations
**Location:** [src/screens/common/RulesRegulationsScreen.jsx](../src/screens/common/RulesRegulationsScreen.jsx)

Official WEBTTODA policies and penalty guidelines.

### Sections
1. **Work and Drive Efficiency**
   - Insubordination
   - Illegal lining
   - Illegal pickup
   - Dress code violations

2. **Act of Dishonesty**
   - Failure to pay dues
   - False statements

3. **Act Against Public Policy**
   - DUI/drugs
   - Illegal gambling
   - Overcharging

4. **Moral Conduct**
   - Profanity
   - Fighting
   - Harassment

5. **Safety Regulations**
   - Vehicle condition
   - Traffic violations
   - Passenger safety

### Features
- **Multi-language**: English/Filipino toggle
- **Searchable**: Find specific rules
- **Penalty reference**: Offense levels (1st, 2nd, 3rd, 4th)
- **Section navigation**: Quick jump to sections

### Penalty Levels
- 1st Offense: Warning/3-day suspension
- 2nd Offense: 1-week suspension
- 3rd Offense: 1-month suspension/dismissal
- 4th Offense: Dismissal

---

## About Screen
**Location:** [src/screens/common/about.jsx](../src/screens/common/about.jsx)

App and organization information.

### Content
- App name and version
- WEBTTODA description
- Contact information
- Terms of service
- Privacy policy

---

## Booking History Detail
**Location:** [src/screens/common/BookingHistoryDetail.jsx](../src/screens/common/BookingHistoryDetail.jsx)

Detailed view of past bookings.

### Information Displayed
- Pickup and destination addresses
- Date and time
- Final fare
- Driver/passenger info
- Trip duration
- Rating given/received
- Route map

---

## Suspension Screen (Drivers Only)
**Location:** [src/screens/common/SuspendedScreen.jsx](../src/screens/common/SuspendedScreen.jsx)

Displayed when a driver is suspended.

### Information
- Suspension reason
- Start date
- End date
- Days remaining
- Appeal information

### Restrictions
- Cannot access home screen
- Cannot accept bookings
- Cannot join queue
- Limited navigation

---

## Common Components

### Activity Tracker
**Location:** [src/components/common/ActivityTracker.jsx](../src/components/common/ActivityTracker.jsx)

Tracks user activity for analytics.

### Announcement Modal
**Location:** [src/components/common/announcementModal.jsx](../src/components/common/announcementModal.jsx)

Displays system announcements on app open.

### App Drawer
**Location:** [src/components/common/appdrawer.jsx](../src/components/common/appdrawer.jsx)

Side navigation drawer with role-based items.

### Complaint Notification Modal
**Location:** [src/components/common/ComplaintNotificationModal.jsx](../src/components/common/ComplaintNotificationModal.jsx)

Real-time notification when complaint is filed/updated.

### Empty State
**Location:** [src/components/common/EmptyState.jsx](../src/components/common/EmptyState.jsx)

Placeholder for empty lists.

### Error Display
**Location:** [src/components/common/ErrorDisplay.jsx](../src/components/common/ErrorDisplay.jsx)

Error message component.

### Loading Screen
**Location:** [src/components/common/LoadingScreen.jsx](../src/components/common/LoadingScreen.jsx)

Full-screen loading indicator.

### Notification Bell
**Location:** [src/components/common/notificationBell.jsx](../src/components/common/notificationBell.jsx)

Header notification icon with badge.

### Notification Handler
**Location:** [src/components/common/NotificationHandler.jsx](../src/components/common/NotificationHandler.jsx)

Handles incoming push notifications.

### Sweet Alert
**Location:** [src/components/common/SweetAlert.jsx](../src/components/common/SweetAlert.jsx)

Custom alert dialogs.

### Toast Helper
**Location:** [src/components/common/toasthelper.jsx](../src/components/common/toasthelper.jsx)

Toast message utility.

### Weather Advisory Modal
**Location:** [src/components/common/WeatherAdvisoryModal.jsx](../src/components/common/WeatherAdvisoryModal.jsx)

Automatic weather warnings.

### Theme
**Location:** [src/components/common/theme.js](../src/components/common/theme.js)

Color palette, spacing, and typography definitions.

```javascript
export const colors = {
  primary: '#F28C28',      // WEBTTODA Orange
  background: '#FFFBF5',   // Ivory background
  // ... more colors
};

export const spacing = {
  small: 8,
  medium: 16,
  large: 24,
  // ... more spacing
};
```

---

## Utility Functions

### JWT Storage
**Location:** [src/utils/jwtStorage.js](../src/utils/jwtStorage.js)

SQLite-based JWT token management.

### User Storage
**Location:** [src/utils/userStorage.js](../src/utils/userStorage.js)

AsyncStorage-based user data persistence.

### Config
**Location:** [src/utils/config.js](../src/utils/config.js)

API URL and environment configuration.

### Firebase Config
**Location:** [src/utils/firebaseConfig.js](../src/utils/firebaseConfig.js)

Firebase initialization for auth and FCM.

### Notification Utils
**Location:** [src/utils/notification.js](../src/utils/notification.js)

Push notification registration and handling.

### Coding Day Utils
**Location:** [src/utils/codingDayUtils.js](../src/utils/codingDayUtils.js)

Coding day calculation and status.

### Route Service
**Location:** [src/utils/routeService.js](../src/utils/routeService.js)

Route calculation and fare estimation.

### GPX Parser
**Location:** [src/utils/gpxParser.js](../src/utils/gpxParser.js)

GPX file parsing and service area validation.

---

## Context Providers

### SweetAlertContext
**Location:** [src/context/SweetAlertContext.jsx](../src/context/SweetAlertContext.jsx)

Global alert dialog management.

### AsyncSQLiteProvider
**Location:** [src/utils/asyncSQliteProvider.js](../src/utils/asyncSQliteProvider.js)

SQLite database context for JWT storage.
