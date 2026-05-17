// swift-tools-version: 5.9

import PackageDescription

let package = Package(
    name: "AonsokuNativeData",
    platforms: [.iOS(.v15)],
    products: [
        .library(
            name: "AonsokuNativeDataPlugin",
            targets: ["AonsokuNativeDataPlugin"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "8.0.0"),
        .package(url: "https://github.com/groue/GRDB.swift.git", from: "7.0.0"),
        .package(path: "../aonsoku-native-bridge")
    ],
    targets: [
        .target(
            name: "AonsokuNativeDataPlugin",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm"),
                .product(name: "Cordova", package: "capacitor-swift-pm"),
                .product(name: "GRDB", package: "GRDB.swift"),
                .product(name: "AonsokuNativeBridgePlugin", package: "aonsoku-native-bridge")
            ],
            path: "ios/Sources/AonsokuNativeDataPlugin")
    ]
)
