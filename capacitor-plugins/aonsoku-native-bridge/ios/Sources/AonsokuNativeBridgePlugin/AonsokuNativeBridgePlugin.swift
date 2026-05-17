import Foundation
import Capacitor

@objc(AonsokuNativeBridgePlugin)
public class AonsokuNativeBridgePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AonsokuNativeBridgePlugin"
    public let jsName = "AonsokuNativeBridge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "storeCredentials", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getCredentials", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearCredentials", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "hasCredentials", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "login", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "ping", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "queryServerInfo", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "request", returnType: CAPPluginReturnPromise),
    ]

    // MARK: - Credential Management

    @objc func storeCredentials(_ call: CAPPluginCall) {
        guard let serverUrl = call.getString("serverUrl"),
              let username = call.getString("username"),
              let password = call.getString("password"),
              let authType = call.getString("authType"),
              let protocolVersion = call.getString("protocolVersion"),
              let serverType = call.getString("serverType") else {
            call.reject("Missing required credential fields")
            return
        }

        let credentials = ServerCredentials(
            serverUrl: serverUrl,
            username: username,
            password: password,
            authType: authType,
            protocolVersion: protocolVersion,
            serverType: serverType,
            fallbackUrl: call.getString("fallbackUrl")
        )

        do {
            try KeychainManager.store(credentials)
            call.resolve()
        } catch {
            call.reject("Failed to store credentials: \(error.localizedDescription)")
        }
    }

    @objc func getCredentials(_ call: CAPPluginCall) {
        guard let credentials = KeychainManager.retrieve() else {
            call.resolve([:])
            return
        }

        var result: [String: Any] = [
            "serverUrl": credentials.serverUrl,
            "username": credentials.username,
            "authType": credentials.authType,
            "protocolVersion": credentials.protocolVersion,
            "serverType": credentials.serverType,
        ]

        if let fallbackUrl = credentials.fallbackUrl {
            result["fallbackUrl"] = fallbackUrl
        }

        call.resolve(result)
    }

    @objc func clearCredentials(_ call: CAPPluginCall) {
        KeychainManager.delete()
        call.resolve()
    }

    @objc func hasCredentials(_ call: CAPPluginCall) {
        call.resolve(["stored": KeychainManager.exists()])
    }

    // MARK: - Login & Server Validation (Phase 2)

    @objc func login(_ call: CAPPluginCall) {
        call.reject("Not yet implemented")
    }

    @objc func ping(_ call: CAPPluginCall) {
        call.reject("Not yet implemented")
    }

    @objc func queryServerInfo(_ call: CAPPluginCall) {
        call.reject("Not yet implemented")
    }

    // MARK: - API Request Proxy (Phase 2)

    @objc func request(_ call: CAPPluginCall) {
        call.reject("Not yet implemented")
    }
}
