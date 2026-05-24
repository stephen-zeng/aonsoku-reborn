import UIKit
import Capacitor
import WebKit

class AonsokuViewController: CAPBridgeViewController {
    private let mediaSchemeHandler = MediaSchemeHandler()

    @available(iOS 16.4, *)
    override var editingInteractionConfiguration: UIEditingInteractionConfiguration {
        .none
    }

    override func webViewConfiguration(for instanceConfiguration: InstanceConfiguration) -> WKWebViewConfiguration {
        let config = super.webViewConfiguration(for: instanceConfiguration)
        config.setURLSchemeHandler(mediaSchemeHandler, forURLScheme: "aonsoku-media")
        return config
    }
}

