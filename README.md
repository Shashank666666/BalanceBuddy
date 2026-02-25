# BalanceBuddy

A modern expense tracking and trip management mobile app built with React Native and Expo. BalanceBuddy helps users manage shared expenses, track spending across multiple currencies, and collaborate on trips with friends and family.

## 🚀 Features

### Core Functionality
- **Trip Management**: Create and manage multiple trips with different participants
- **Expense Tracking**: Add, categorize, and track expenses within trips
- **Multi-Currency Support**: Real-time currency conversion and support for multiple currencies
- **User Authentication**: Secure sign-up and login with Firebase Authentication
- **Real-time Sync**: Real-time data synchronization across all devices

### User Interface
- **Modern Dark Theme**: Beautiful glassmorphic design with midnight ocean color scheme
- **Cross-Platform**: Works seamlessly on iOS, Android, and Web
- **Responsive Design**: Optimized for different screen sizes
- **Smooth Animations**: Fluid transitions and micro-interactions

### Advanced Features
- **Activity Feed**: Track all recent activities and changes
- **Trip Archives**: Archive and restore old trips
- **Profile Management**: Customizable user profiles with avatars
- **Currency Converter**: Built-in currency conversion tool
- **Destination Details**: Rich information about trip destinations

## 🛠 Tech Stack

### Frontend
- **React Native** (0.81.5) - Cross-platform mobile development
- **Expo** (~54.0.33) - Development platform and tooling
- **React Navigation** - Navigation and routing
- **Expo Linear Gradient** - Beautiful gradient effects
- **Expo Image Picker** - Image handling and selection

### Backend & Services
- **Firebase Authentication** - User authentication
- **Firebase Firestore** - Real-time database
- **Firebase SDK** - Backend services integration

### Development Tools
- **Babel** - JavaScript transpilation
- **Metro** - JavaScript bundler
- **ESLint** - Code linting (if configured)

## 📱 Installation & Setup

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- Physical device or emulator/simulator

### Clone and Install
```bash
# Clone the repository
git clone https://github.com/Shashank666666/BalanceBuddy.git
cd BalanceBuddy

# Install dependencies
npm install

# Start the development server
npm start
```

### Running the App
```bash
# Start Expo development server
npm start

# Run on specific platforms
npm run android    # For Android
npm run ios        # For iOS
npm run web        # For Web
```

## 🔧 Configuration

### Firebase Setup
1. Create a new Firebase project at [Firebase Console](https://console.firebase.google.com/)
2. Enable Authentication (Email/Password) and Firestore Database
3. Download the configuration files:
   - For Android: `google-services.json` → place in `android/app/`
   - For iOS: `GoogleService-Info.plist` → place in `ios/BalanceBuddy/`
4. Update Firebase configuration in `src/config/firebase.js`

### Environment Variables
Create a `.env` file in the root directory (optional):
```
EXPO_PUBLIC_FIREBASE_API_KEY=your_api_key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_domain
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_bucket
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
EXPO_PUBLIC_FIREBASE_APP_ID=your_app_id
```

## 📁 Project Structure

```
BalanceBuddy/
├── src/
│   ├── components/          # Reusable UI components
│   ├── config/             # Configuration files (Firebase)
│   ├── constants/          # App constants and theme
│   ├── context/            # React Context providers
│   ├── navigation/         # Navigation configuration
│   └── screens/            # App screens
├── assets/                 # Static assets (images, fonts)
├── android/               # Android-specific files
├── ios/                   # iOS-specific files
├── App.js                 # Main app entry point
├── package.json           # Dependencies and scripts
└── README.md             # This file
```

## 🎨 Theme & Design

The app features a sophisticated dark theme with:
- **Primary Colors**: Midnight Ocean blues and teals
- **Glassmorphism**: Translucent cards with backdrop blur
- **Gradients**: Beautiful linear gradients for buttons and accents
- **Typography**: Clean, readable fonts with proper hierarchy

## 🚀 Deployment

### Building for Production
```bash
# Build for Android
expo build:android

# Build for iOS
expo build:ios

# Build for Web
expo build:web
```

### Publishing to App Stores
1. Configure app.json with your app details
2. Set up app store accounts (Google Play Console, Apple App Store)
3. Use Expo Application Services (EAS) for building and submitting

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🐛 Issues & Support

If you encounter any issues or have suggestions:
- Check existing [Issues](https://github.com/Shashank666666/BalanceBuddy/issues)
- Create a new issue with detailed description
- Include steps to reproduce and error messages

## 🙏 Acknowledgments

- [Expo](https://expo.dev/) - For the amazing development platform
- [React Native](https://reactnative.dev/) - For the cross-platform framework
- [Firebase](https://firebase.google.com/) - For backend services
- [React Navigation](https://reactnavigation.org/) - For navigation solution

## 📊 App Stats

- **Platform**: iOS, Android, Web
- **Framework**: React Native with Expo
- **Backend**: Firebase (Auth + Firestore)
- **UI**: Custom dark theme with glassmorphism
- **Real-time**: Yes, with Firebase listeners

---

**BalanceBuddy** - Making expense tracking simple and beautiful! 💙🚀
