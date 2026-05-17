// swift-tools-version: 5.9

import PackageDescription

let package = Package(
    name: "AonsokuNativeAudio",
    platforms: [.iOS(.v15)],
    products: [
        .library(
            name: "AonsokuNativeAudio",
            targets: ["AonsokuNativeAudioPlugin"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "8.0.0"),
        .package(path: "../aonsoku-native-bridge")
    ],
    targets: [
        .target(
            name: "AonsokuNativeAudioPlugin",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm"),
                .product(name: "AonsokuNativeBridgePlugin", package: "aonsoku-native-bridge")
            ],
            path: "ios/Sources/AonsokuNativeAudioPlugin")
    ]
)
