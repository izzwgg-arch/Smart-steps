# Building Debug APK for Smart Steps Android

## Prerequisites
- Android Studio is installed and open
- Node.js and npm are installed
- Android SDK is configured

## Step 1: Open Project in Android Studio

1. In Android Studio, click **File → Open**
2. Navigate to: `c:\dev\projects\A Plus center\smart-steps-android\android`
3. Select the `android` folder and click **OK**
4. Android Studio will sync the Gradle files (this may take a few minutes)

## Step 2: Build Debug APK

### Option A: Using Android Studio GUI

1. In Android Studio, go to **Build → Build Bundle(s) / APK(s) → Build APK(s)**
2. Wait for the build to complete
3. When finished, click **locate** in the notification, or navigate to:
   ```
   android\app\build\outputs\apk\debug\app-debug.apk
   ```

### Option B: Using Command Line

Open PowerShell or Command Prompt in the project root and run:

```powershell
cd android
.\gradlew assembleDebug
```

The APK will be generated at:
```
android\app\build\outputs\apk\debug\app-debug.apk
```

## Step 3: Install APK on Device

### Using ADB (Android Debug Bridge):

```powershell
adb install android\app\build\outputs\apk\debug\app-debug.apk
```

### Manual Installation:

1. Transfer the APK file to your Android device
2. On your device, enable **Install from Unknown Sources** in Settings
3. Open the APK file and tap **Install**

## Troubleshooting

### Build Errors

If you encounter build errors:

1. **Clean the project:**
   ```powershell
   cd android
   .\gradlew clean
   ```

2. **Invalidate caches in Android Studio:**
   - File → Invalidate Caches → Invalidate and Restart

3. **Check SDK versions:**
   - Ensure Android SDK 34 is installed
   - Ensure Build Tools 34.0.0 is installed

### Missing Dependencies

If dependencies are missing:

```powershell
cd "c:\dev\projects\A Plus center\smart-steps-android"
npm install
```

### Gradle Sync Issues

1. In Android Studio: **File → Sync Project with Gradle Files**
2. If that doesn't work, close Android Studio and run:
   ```powershell
   cd android
   .\gradlew clean
   ```

## Important Notes

- **Debug APK**: This APK is signed with a debug keystore and is suitable for testing only
- **Backend URL**: Before building, update `mobile-config.js` with your backend server URL
- **Package Name**: The app uses package name `com.smartsteps`
- **Min SDK**: Android 5.0 (API 21) or higher required

## Next Steps

After building the debug APK:
1. Test the app on a device or emulator
2. Verify all features work correctly
3. For production, you'll need to create a release keystore and build a release APK
