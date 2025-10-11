// // app.config.js (create this file in your root directory)
// import 'dotenv/config';

// export default {
//   expo: {
//     name: "anontalk",
//     slug: "anontalk",
//     version: "1.0.0",
//     orientation: "portrait",
//     icon: "./assets/icon.png",
//     userInterfaceStyle: "light",
//     splash: {
//       image: "./assets/icon.png",
//       resizeMode: "contain", 
//       backgroundColor: "#ffffff"
//     },
//     assetBundlePatterns: [
//       "**/*"
//     ],
//     ios: {
//       supportsTablet: true
//     },
//     android: {
//       adaptiveIcon: {
//         foregroundImage: "./assets/icon.png",
//         backgroundColor: "#ffffff"
//       },
//       package: "com.paul2508.anontalk"
//     },
//     web: {
//       favicon: "./assets/favicon.png"
//     },
//     extra: {
//       SUPABASE_URL: process.env.SUPABASE_URL,
//       SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
//       eas: {
//         projectId: "f94358f3-182f-411c-978e-30fbbe5c999a" // Add your EAS project ID here
//       }
//     },
//     plugins: [
//       [
//         "expo-build-properties",
//         {
//           android: {
//             enableProguardInReleaseBuilds: true,
//             enableShrinkResourcesInReleaseBuilds: true
//           }
//         }
//       ]
//     ]
//   }
// };


import 'dotenv/config';

export default {
  expo: {
    name: "anontalk",
    slug: "anontalk",
    version: "1.0.4",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    splash: {
      image: "./assets/icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    assetBundlePatterns: ["**/*"],
    
    // ✅ Add this block:
    updates: {
      url: "https://u.expo.dev/f94358f3-182f-411c-978e-30fbbe5c999a"
    },
    // runtimeVersion: {
    //   policy: "appVersion"
    // },
      runtimeVersion: "1.0.4",


    ios: {
      supportsTablet: true
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/icon.png",
        backgroundColor: "#ffffff"
      },
      package: "com.paul2508.anontalk"
    },
    web: {
      favicon: "./assets/favicon.png"
    },
    extra: {
      SUPABASE_URL: process.env.SUPABASE_URL,
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
      eas: {
        projectId: "f94358f3-182f-411c-978e-30fbbe5c999a"
      }
    },
   "plugins": [
  [
    "expo-build-properties",
    {
      "android": {
        "enableProguardInReleaseBuilds": true,
        "enableShrinkResourcesInReleaseBuilds": true
      }
    }
  ],
  "expo-font"
]

  }
};
