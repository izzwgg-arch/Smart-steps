# Smart Steps Android Mobile Application

Native-feel Android version of the Smart Steps desktop application, built with React Native.

## 🏗️ Architecture: "Stay Safe" Design

This Android app is **completely isolated** from the desktop application:

- ✅ **Directory Isolation**: All mobile code lives in `/smart-steps-android`
- ✅ **Read-Only Reference**: Mobile app reads desktop code for business logic understanding, but never modifies it
- ✅ **Logic Cloning**: Business logic is copied (not linked) to prevent ripple effects
- ✅ **API Integration**: Mobile app communicates with existing backend via REST API

## 📱 Features

### Full Feature Parity
- ✅ **Invoices**: View, create, edit invoices with modern card-based UI
- ✅ **Time Sheets**: Create, submit, approve timesheets with mobile-optimized forms
- ✅ **Client Management**: Manage clients with signature support
- ✅ **Provider Management**: Manage providers with signature capture
- ✅ **Signature System**: Mobile-native signature pad with auto-pull from stored signatures

### Android-Friendly UI
- Material Design 3 components
- Bottom Navigation Bar
- Floating Action Buttons (FAB)
- Card-based layouts for vertical scrolling
- Touch-optimized (minimum 48dp touch targets)
- Responsive design for various screen sizes

## 🔌 Backend Integration

### How the Android App Connects to the Database

The Android app **does NOT directly access the database**. Instead, it communicates with the existing Next.js backend through REST API endpoints:

```
┌─────────────────┐         HTTP/REST API         ┌──────────────────┐
│  Android App    │ ──────────────────────────────> │  Next.js Backend │
│  (React Native) │                                 │  (Desktop App)   │
└─────────────────┘                                 └──────────────────┘
                                                             │
                                                             │ Prisma ORM
                                                             ▼
                                                    ┌──────────────────┐
                                                    │  PostgreSQL DB   │
                                                    └──────────────────┘
```

### API Communication Flow

1. **Authentication**: Mobile app authenticates via `/api/auth/session` endpoint
2. **Data Requests**: All CRUD operations go through existing API routes:
   - `/api/providers` - Provider management
   - `/api/clients` - Client management
   - `/api/timesheets` - Timesheet operations
   - `/api/invoices` - Invoice management
   - And all other existing endpoints...

3. **No Database Changes**: The mobile app uses the **exact same database** as the desktop app, but accesses it **only through the API layer**. This ensures:
   - ✅ No database schema conflicts
   - ✅ No direct database access from mobile
   - ✅ All business logic remains in the backend
   - ✅ Desktop and mobile share the same data source

### Configuration

See `mobile-config.js` for API endpoint mapping. The mobile app points to the same backend server as the desktop application.

**Local Development:**
- Android Emulator: `http://10.0.2.2:3000`
- Physical Device: `http://YOUR_COMPUTER_IP:3000`

**Production:**
- Use your production server URL (e.g., `http://66.94.105.43:3000`)

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- React Native CLI
- Android Studio
- Java Development Kit (JDK) 17+

### Installation

1. **Install dependencies:**
```bash
cd smart-steps-android
npm install
```

2. **Configure API endpoint:**
Edit `mobile-config.js` and set `API_BASE_URL` to your backend server URL.

3. **Start Metro bundler:**
```bash
npm start
```

4. **Run on Android:**
```bash
npm run android
```

### Environment Setup

Create a `.env` file (optional):
```
API_BASE_URL=http://10.0.2.2:3000
```

## 📁 Project Structure

```
smart-steps-android/
├── android/                 # Native Android code
│   ├── app/
│   │   └── src/main/
│   │       ├── AndroidManifest.xml
│   │       └── res/
│   │           └── xml/
│   │               ├── network_security_config.xml
│   │               └── file_paths.xml
├── src/
│   ├── api/                # API service layer
│   ├── components/          # Reusable components
│   ├── navigation/          # Navigation setup
│   ├── screens/             # Screen components
│   ├── services/            # Business logic services
│   ├── utils/               # Utility functions
│   └── types/               # TypeScript types
├── mobile-config.js         # API endpoint configuration
├── package.json
└── README.md
```

## 🔐 Permissions

The Android app requires the following permissions (configured in `AndroidManifest.xml`):

- **Internet**: For API calls
- **File Storage**: For saving/reading PDFs and signature files
- **Camera**: For capturing new signatures
- **Network State**: For checking connectivity

## 🎨 UI/UX Guidelines

### Material Design 3
- Use Material Design 3 components from `react-native-paper`
- Follow Material Design color system
- Implement proper elevation and shadows

### Touch Targets
- Minimum 48dp x 48dp for all interactive elements
- Adequate spacing between touch targets
- Visual feedback on touch

### Navigation
- Bottom Navigation Bar for main sections
- Stack Navigation for detail screens
- Floating Action Button for primary actions

### Data Display
- Convert wide tables to card-based layouts
- Use vertical scrolling lists
- Implement pull-to-refresh
- Show loading states

## 📝 Signature System

The mobile app implements a native signature capture system:

1. **Capture**: Users can draw signatures using touch
2. **Upload**: Signatures are uploaded to the backend
3. **Retrieval**: Stored signatures are automatically pulled for parents/providers
4. **Display**: Signatures are rendered in invoices and timesheets

## 🔄 Data Synchronization

- **Real-time**: All data operations sync immediately with backend
- **Offline Mode**: Future enhancement for offline data caching
- **Conflict Resolution**: Handled by backend (single source of truth)

## 🧪 Testing

```bash
npm test
```

## 📦 Building for Production

1. **Generate signed APK:**
```bash
cd android
./gradlew assembleRelease
```

2. **Generate AAB (for Play Store):**
```bash
./gradlew bundleRelease
```

## 🔒 Security Considerations

- All API calls use HTTPS in production
- Authentication tokens stored securely in AsyncStorage
- Sensitive data never logged
- File permissions properly scoped

## 📚 Additional Resources

- [React Native Documentation](https://reactnative.dev/)
- [React Navigation](https://reactnavigation.org/)
- [React Native Paper](https://callstack.github.io/react-native-paper/)
- [Material Design 3](https://m3.material.io/)

## 🤝 Contributing

When adding new features:

1. **Never modify desktop code** - Keep mobile code isolated
2. **Clone business logic** - Copy needed logic into mobile directory
3. **Use existing APIs** - Leverage existing backend endpoints
4. **Follow Material Design** - Maintain consistent UI/UX

## 📄 License

Same license as the main Smart Steps application.
