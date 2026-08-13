# Quick Start: Build APK in Android Studio

## ✅ Project is Ready!

All Android build files have been created. Here's how to build your APK:

## Method 1: Android Studio (Recommended)

1. **Open Android Studio**

2. **Open Project:**
   - Click **File → Open**
   - Navigate to: `c:\dev\projects\A Plus center\smart-steps-android\android`
   - Select the **`android`** folder (not the parent folder)
   - Click **OK**

3. **Wait for Gradle Sync:**
   - Android Studio will automatically sync Gradle files
   - This may take 2-5 minutes the first time
   - Watch the bottom status bar for "Gradle sync completed"

4. **Build APK:**
   - Click **Build → Build Bundle(s) / APK(s) → Build APK(s)**
   - Wait for build to complete (watch the bottom status bar)
   - When done, click **"locate"** in the notification popup

5. **Find Your APK:**
   - The APK will be at:
   ```
   android\app\build\outputs\apk\debug\app-debug.apk
   ```

## Method 2: Command Line (If Gradle Wrapper is Set Up)

If you have the Gradle wrapper JAR file, you can use:

```powershell
cd "c:\dev\projects\A Plus center\smart-steps-android\android"
.\gradlew.bat assembleDebug
```

**Note:** The first time you run this, Gradle will download dependencies which may take several minutes.

## Troubleshooting

### "Gradle wrapper JAR not found"
If you see this error, you need to download the Gradle wrapper JAR. The easiest way is to use Android Studio (Method 1 above) which will handle this automatically.

### "JAVA_HOME is not set"
Make sure you have Java JDK installed and JAVA_HOME is set. Android Studio includes its own JDK, so using Android Studio (Method 1) avoids this issue.

### Build Errors
1. Make sure you're in the `android` folder when opening in Android Studio
2. Wait for Gradle sync to complete before building
3. If errors persist, try: **File → Invalidate Caches → Invalidate and Restart**

## What You'll Get

After a successful build, you'll have:
- **File:** `app-debug.apk`
- **Location:** `android\app\build\outputs\apk\debug\`
- **Size:** Approximately 20-30 MB
- **Type:** Debug APK (suitable for testing)

## Install on Device

1. Transfer the APK to your Android device
2. Enable "Install from Unknown Sources" in device settings
3. Open the APK file and tap Install

Or use ADB:
```powershell
adb install android\app\build\outputs\apk\debug\app-debug.apk
```

## Next Steps

Once you have the APK:
1. Test all features
2. Verify backend connection (update `mobile-config.js` if needed)
3. For production, create a release keystore and build a release APK
