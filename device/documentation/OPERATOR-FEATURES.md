# Operator Features Documentation

## Overview
Operators are authenticated users with the role `operator`. They are fleet managers who own or manage tricycles and employ drivers. Operators have administrative control over their tricycles, drivers, and daily operations.

---

## Main Screen - Operator Dashboard

**Location:** [src/screens/operator/OperatorScreen.jsx](../src/screens/operator/OperatorScreen.jsx)

Operators have a dedicated bottom tab navigator with the following tabs:

### 1. Overview Tab
**Location:** [src/screens/operator/tabs/OverviewTab.jsx](../src/screens/operator/tabs/OverviewTab.jsx)

Fleet overview and quick actions.

**Features:**

#### Statistics Cards
- **Total tricycles**: Count of all owned vehicles
- **Assigned**: Tricycles with drivers
- **Unassigned**: Available tricycles
- **Available today**: Drivers scheduled to work

#### Alert Cards
- Quick access to vehicles needing attention
- Overdue maintenance warnings
- Unassigned tricycles

#### Tricycle List
**Component:** [src/screens/operator/TricycleListItem.jsx](../src/screens/operator/TricycleListItem.jsx)

Each tricycle shows:
- Plate number
- Body number
- Model
- Driver assigned (if any)
- Schedule (if shared)
- Current odometer
- Status indicators

#### Filtering
- **All**: View entire fleet
- **Assigned**: Only with drivers
- **Unassigned**: Available vehicles
- **Available today**: No driver scheduled today

#### Quick Actions per Tricycle
- **Assign driver**: Add a driver (or additional schedule)
- **Unassign driver**: Remove driver assignment
- **View details**: Full tricycle information
- **Maintenance history**: Service records
- **Message driver**: Direct chat

#### Weather Widget
- Current conditions for planning operations

---

### 2. Drivers Tab
**Location:** [src/screens/operator/tabs/DriversTab.jsx](../src/screens/operator/tabs/DriversTab.jsx)

Manage drivers under the operator's fleet.

**Features:**

#### Driver Modes
- **Available drivers**: Unassigned, ready to work
- **All drivers**: Complete roster

#### Search & Filter
- Search by name, username, email, phone
- Real-time filtering

#### Driver Statistics
- Available count
- Total count

#### Driver List
**Component:** [src/screens/operator/DriverListItem.jsx](../src/screens/operator/DriverListItem.jsx)

Each driver shows:
- Avatar
- Full name
- Username
- Rating
- Contact info

#### Driver Profile Modal
Detailed view with:
- Profile image
- Full name and username
- Email and phone
- Rating and review count
- Trip count
- Assignment status

#### Quick Actions per Driver
- **View profile**: Detailed information
- **Call**: Direct phone call
- **Email**: Send email
- **Message**: In-app chat

---

### 3. Sick Leave Tab
**Location:** [src/screens/operator/tabs/SickLeaveTab.jsx](../src/screens/operator/tabs/SickLeaveTab.jsx)

Manage driver sick leave requests.

**Features:**

#### Sick Leave Statistics
- Total requests
- Pending approval
- Approved this month
- Rejected

#### Status Filter
- All requests
- Pending
- Approved
- Rejected
- Cancelled

#### Request List
Each request shows:
- Driver name and avatar
- Start and end dates
- Duration (days)
- Reason
- Medical certificate indicator
- Emergency contact
- Submission time (relative)

#### Actions on Requests
- **Approve**: Grant leave
- **Reject**: Deny with reason (modal)
- **View details**: Full request information

#### Request Detail Modal
- Medical certificate preview
- Full reason text
- Emergency contact details
- Approval/rejection history

---

### 4. Maintenance Approval Tab
**Location:** [src/screens/operator/tabs/MaintenanceApprovalTab.jsx](../src/screens/operator/tabs/MaintenanceApprovalTab.jsx)

Review and approve driver-submitted maintenance records.

**Features:**

#### Grouped by Tricycle
- Organized tiles per vehicle
- Shows driver name
- Count of pending records

#### Tile Detail Modal
Records for selected tricycle:
- Maintenance type
- Completion date/time
- Odometer reading
- Cost
- Notes
- Proof images

#### Actions per Record
- **Approve**: Verify maintenance completed
- **Reject**: Deny with reason

#### Image Preview
- Full-screen proof photo viewing
- Zoom capability

---

### 5. Driver Complaints Tab
**Location:** [src/screens/operator/tabs/DriverComplaintsTab.jsx](../src/screens/operator/tabs/DriverComplaintsTab.jsx)

Monitor complaints filed against drivers.

**Features:**
- View complaints for fleet drivers
- Complaint details and evidence
- Status tracking
- Response/resolution status

---

## Modals & Actions

### Add Tricycle Modal
**Location:** [src/screens/operator/modals/AddTricycleModal.jsx](../src/screens/operator/modals/AddTricycleModal.jsx)

Register a new tricycle.

**Fields:**
- **Plate number**: Required, format: 123ABC
- **Body number**: Optional, 4 digits
- **Model**: Required, tricycle model
- **Current odometer**: Initial mileage

**Validation:**
- Plate number format enforcement
- Duplicate plate check

---

### Assign Driver Modal
**Location:** [src/screens/operator/modals/AssignDriverModal.jsx](../src/screens/operator/modals/AssignDriverModal.jsx)

Assign a driver to a tricycle.

**Assignment Types:**

#### Exclusive Assignment
- One driver owns the tricycle
- No scheduling required
- Full-time operation

#### Shared Assignment (Scheduled)
- Multiple drivers share vehicle
- Configure schedule:
  - Days of week (Mon-Sun)
  - Start time
  - End time

**Boundary Settlement:**
- Daily boundary amount (₱)
- Settlement type: daily/weekly/monthly
- Notes

---

### Unassign Driver Modal
**Location:** [src/screens/operator/modals/UnassignDriverModal.jsx](../src/screens/operator/modals/UnassignDriverModal.jsx)

Remove driver assignment.

**For shared tricycles:**
- Select which schedule to remove
- Confirms driver will lose access

**For exclusive:**
- Simple confirmation dialog

---

### Tricycle Details Modal
**Location:** [src/screens/operator/modals/TricycleDetailsModal.jsx](../src/screens/operator/modals/TricycleDetailsModal.jsx)

Full vehicle information.

**Displays:**
- Plate and body numbers
- Model
- Current odometer
- CR (Certificate of Registration) data
- OR (Official Receipt) data
- Assigned driver(s)
- Schedules
- Coding day
- Status

---

### Maintenance Modal
**Location:** [src/screens/operator/modals/MaintenanceModal.jsx](../src/screens/operator/modals/MaintenanceModal.jsx)

View maintenance history for a tricycle.

**Features:**
- Service history timeline
- Completed maintenance items
- Pending/overdue items
- Total maintenance costs

---

### Message Selection Modal
**Location:** [src/screens/operator/modals/MessageSelectionModal.jsx](../src/screens/operator/modals/MessageSelectionModal.jsx)

Quick message driver selection.

---

## Boundary Settlements Screen
**Location:** [src/screens/operator/BoundarySettlementsScreen.jsx](../src/screens/operator/BoundarySettlementsScreen.jsx)

Manage daily fare settlements with drivers.

**Features:**

#### Overview Data
- Total expected income
- Pending settlements
- Confirmed settlements
- Settlement history

#### Tabs
1. **Pending**: Awaiting confirmation
2. **History**: Past settlements
3. **Tricycles**: Per-vehicle summary

#### Pending Settlements
Each shows:
- Driver name
- Tricycle details
- Date
- Amount due
- Settlement type

#### Actions
- **Confirm**: Verify payment received
- **Dispute**: Flag discrepancy

#### Settlement Details
- Full breakdown
- Driver notes
- Confirmation timestamp

---

## Drawer Navigation

Operators have access to these drawer items:

| Item | Description |
|------|-------------|
| Operator | Return to main operator dashboard |
| Boundary Settlements | Manage driver payments |
| Account | Profile management |
| Forum | Community discussions |
| Notifications | Inbox for push notifications |
| About | App information |
| Lost & Found | Post/browse lost items |
| Rules & Regulations | WEBTTODA policies |

> **Note:** Operators do NOT see the Home tab (dashboard is their main screen)

---

## Maps Tab
**Location:** [src/screens/dashboard/MapsTab.jsx](../src/screens/dashboard/MapsTab.jsx)

Operators can access maps for fleet overview.

**Features:**
- View service area
- No active trip tracking (operators don't drive)
- Queue visibility

---

## Messages
Operators can message:
- Their assigned drivers
- Other operators (limited)
- Admin/support

---

## Common Features (Shared with Drivers)

### Account Management
- Profile editing
- Profile photo
- No license upload (operators don't drive)

### Forum Participation
- View and create posts
- Interact with driver community

### Lost & Found
- Post/browse items
- Mark as claimed

### Rules & Regulations
- View WEBTTODA policies
- Same content as drivers

### Notifications
- Sick leave requests
- Maintenance approvals
- Settlement confirmations
- Announcements

---

## Push Notifications

Operators receive FCM push notifications for:

| Event | Priority |
|-------|----------|
| New sick leave request | High |
| Maintenance needs approval | Normal |
| Settlement pending | Normal |
| Driver complaint | High |
| Announcement | Normal |
| New message | Normal |

---

## Technical Details

### State Management
- **Redux**: Operator reducer ([src/redux/reducers/operatorReducer.js](../src/redux/reducers/operatorReducer.js))
- **Operator Actions**: ([src/redux/actions/operatorAction.js](../src/redux/actions/operatorAction.js))

### Key Redux Actions
```javascript
- fetchOperatorData()      // Load tricycles and drivers
- assignDriver()           // Assign driver to tricycle
- unassignDriver()         // Remove assignment
- createTricycle()         // Add new tricycle
- fetchSickLeaves()        // Get sick leave requests
- approveSickLeave()       // Approve request
- rejectSickLeave()        // Reject with reason
```

### Navigation Flow
1. Login → OperatorScreen (main)
2. Tab navigation between sections
3. Drawer for additional screens

### API Endpoints Used
- `GET /api/operator/data` - Fleet data
- `POST /api/tricycles` - Create tricycle
- `PUT /api/tricycles/:id/assign` - Assign driver
- `DELETE /api/tricycles/:id/unassign` - Unassign
- `GET /api/sick-leave/operator` - Sick leaves
- `PUT /api/sick-leave/:id/approve` - Approve
- `PUT /api/sick-leave/:id/reject` - Reject
- `GET /api/boundary/operator-overview` - Settlements
- `PUT /api/boundary/confirm/:id` - Confirm settlement
- `GET /api/maintenance/operator/pending-approvals` - Maintenance

---

## Related Files

- Operator Screen: [src/screens/operator/OperatorScreen.jsx](../src/screens/operator/OperatorScreen.jsx)
- Operator Styles: [src/screens/operator/operatorStyles.jsx](../src/screens/operator/operatorStyles.jsx)
- Operator Helpers: [src/screens/operator/operatorHelpers.js](../src/screens/operator/operatorHelpers.js)
- Redux Actions: [src/redux/actions/operatorAction.js](../src/redux/actions/operatorAction.js)
- Redux Reducer: [src/redux/reducers/operatorReducer.js](../src/redux/reducers/operatorReducer.js)

### Tabs Directory
All operator tabs: [src/screens/operator/tabs/](../src/screens/operator/tabs/)

### Modals Directory
All operator modals: [src/screens/operator/modals/](../src/screens/operator/modals/)
