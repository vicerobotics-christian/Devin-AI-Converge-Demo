// swift-tools-version: 6.2
import PackageDescription

let package = Package(
    name: "ConvergeBridge",
    platforms: [.macOS(.v26)],
    targets: [
        .executableTarget(name: "ConvergeBridge", path: "Sources")
    ]
)
