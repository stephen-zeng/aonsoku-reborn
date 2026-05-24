import UIKit
import AVFoundation
import Capacitor

public final class DebugViewController: UIViewController {
    private let dataProvider: DebugDataProvider
    private var refreshTimer: Timer?
    private let tableView = UITableView(frame: .zero, style: .insetGrouped)

    private enum Section: Int, CaseIterable {
        case playback
        case buffer
        case connection
        case audioSession
        case logs
    }

    private var audioSnapshot: AudioDebugSnapshot?
    private var connectionSnapshot: ConnectionDebugSnapshot?
    private var sessionSnapshot: AudioSessionSnapshot?
    private var memoryMB: Double = 0
    private var logEntries: [NativeLogger.Entry] = []

    public init(bridge: (any CAPBridgeProtocol)?) {
        self.dataProvider = DebugDataProvider(bridge: bridge)
        super.init(nibName: nil, bundle: nil)
    }

    required public init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    public override func viewDidLoad() {
        super.viewDidLoad()
        title = "Debug"
        view.backgroundColor = .systemBackground

        navigationItem.leftBarButtonItem = UIBarButtonItem(
            barButtonSystemItem: .close, target: self, action: #selector(closeTapped)
        )
        navigationItem.rightBarButtonItem = UIBarButtonItem(
            barButtonSystemItem: .refresh, target: self, action: #selector(refreshTapped)
        )

        setupTableView()
        refreshData()
        startAutoRefresh()
    }

    public override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        refreshTimer?.invalidate()
        refreshTimer = nil
    }

    private func setupTableView() {
        tableView.translatesAutoresizingMaskIntoConstraints = false
        tableView.dataSource = self
        tableView.delegate = self
        tableView.register(UITableViewCell.self, forCellReuseIdentifier: "cell")
        view.addSubview(tableView)
        NSLayoutConstraint.activate([
            tableView.topAnchor.constraint(equalTo: view.topAnchor),
            tableView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            tableView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            tableView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])
    }

    private func startAutoRefresh() {
        refreshTimer = Timer.scheduledTimer(withTimeInterval: 2.0, repeats: true) { [weak self] _ in
            self?.refreshData()
        }
    }

    private func refreshData() {
        audioSnapshot = dataProvider.audioSnapshot()
        connectionSnapshot = dataProvider.connectionSnapshot()
        sessionSnapshot = dataProvider.audioSessionSnapshot()
        memoryMB = dataProvider.memoryUsageMB()
        logEntries = NativeLogger.shared.getEntries().reversed()
        tableView.reloadData()
    }

    @objc private func closeTapped() {
        dismiss(animated: true)
    }

    @objc private func refreshTapped() {
        refreshData()
    }

    private func formatTime(_ seconds: Double) -> String {
        guard seconds.isFinite, seconds >= 0 else { return "--:--" }
        let mins = Int(seconds) / 60
        let secs = Int(seconds) % 60
        return String(format: "%d:%02d", mins, secs)
    }
}
// MARK: - UITableViewDataSource

extension DebugViewController: UITableViewDataSource, UITableViewDelegate {
    public func numberOfSections(in tableView: UITableView) -> Int {
        Section.allCases.count
    }

    public func tableView(_ tableView: UITableView, titleForHeaderInSection section: Int) -> String? {
        switch Section(rawValue: section)! {
        case .playback: return "Playback"
        case .buffer: return "Buffer"
        case .connection: return "Connection"
        case .audioSession: return "Audio Session"
        case .logs: return "Logs (\(logEntries.count))"
        }
    }

    public func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        switch Section(rawValue: section)! {
        case .playback: return 6
        case .buffer: return 4
        case .connection: return connectionSnapshot != nil ? 5 : 1
        case .audioSession: return 6
        case .logs: return max(logEntries.count, 1)
        }
    }

    public func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell = tableView.dequeueReusableCell(withIdentifier: "cell", for: indexPath)
        var config = cell.defaultContentConfiguration()
        config.textProperties.font = .monospacedSystemFont(ofSize: 13, weight: .regular)
        config.secondaryTextProperties.font = .monospacedSystemFont(ofSize: 12, weight: .regular)
        config.secondaryTextProperties.color = .secondaryLabel

        switch Section(rawValue: indexPath.section)! {
        case .playback:
            configurePlaybackCell(&config, row: indexPath.row)
        case .buffer:
            configureBufferCell(&config, row: indexPath.row)
        case .connection:
            configureConnectionCell(&config, row: indexPath.row)
        case .audioSession:
            configureAudioSessionCell(&config, row: indexPath.row)
        case .logs:
            configureLogCell(&config, row: indexPath.row)
        }

        cell.contentConfiguration = config
        cell.selectionStyle = .none
        return cell
    }
    private func configurePlaybackCell(_ config: inout UIListContentConfiguration, row: Int) {
        let snap = audioSnapshot
        switch row {
        case 0:
            config.text = "Title"
            config.secondaryText = snap?.title ?? "(none)"
        case 1:
            config.text = "Artist"
            config.secondaryText = snap?.artist ?? "(none)"
        case 2:
            config.text = "Album"
            config.secondaryText = snap?.album ?? "(none)"
        case 3:
            config.text = "State"
            let state = snap?.isPlaying == true ? "playing" : "paused"
            config.secondaryText = state
        case 4:
            config.text = "Progress"
            let cur = formatTime(snap?.currentTime ?? 0)
            let dur = formatTime(snap?.duration ?? 0)
            config.secondaryText = "\(cur) / \(dur)"
        case 5:
            config.text = "Source"
            let kind = snap?.sourceKind ?? "none"
            let queue = "[\(snap?.queueIndex ?? 0)/\(snap?.queueItemCount ?? 0)]"
            config.secondaryText = "\(kind) \(queue) repeat=\(snap?.repeatMode ?? "off") shuffle=\(snap?.shuffleEnabled == true ? "on" : "off")"
        default: break
        }
    }

    private func configureBufferCell(_ config: inout UIListContentConfiguration, row: Int) {
        let snap = audioSnapshot
        switch row {
        case 0:
            config.text = "Buffer Empty"
            config.secondaryText = snap?.bufferEmpty == true ? "YES" : "NO"
            config.textProperties.color = snap?.bufferEmpty == true ? .systemRed : .label
        case 1:
            config.text = "Likely To Keep Up"
            config.secondaryText = snap?.likelyToKeepUp == true ? "YES" : "NO"
            config.textProperties.color = snap?.likelyToKeepUp == true ? .label : .systemOrange
        case 2:
            config.text = "Buffered Time"
            config.secondaryText = formatTime(snap?.bufferedTime ?? 0)
        case 3:
            config.text = "Recovery"
            config.secondaryText = snap?.recoveryState ?? "idle"
            if snap?.recoveryState != "idle" {
                config.textProperties.color = .systemOrange
            }
        default: break
        }
    }
    private func configureConnectionCell(_ config: inout UIListContentConfiguration, row: Int) {
        guard let snap = connectionSnapshot else {
            config.text = "No credentials stored"
            config.textProperties.color = .secondaryLabel
            return
        }
        switch row {
        case 0:
            config.text = "Server"
            config.secondaryText = snap.serverUrl
        case 1:
            config.text = "User"
            config.secondaryText = snap.username
        case 2:
            config.text = "Auth"
            config.secondaryText = snap.authType
        case 3:
            config.text = "Protocol"
            config.secondaryText = "\(snap.protocolVersion) (\(snap.serverType))"
        case 4:
            config.text = "Fallback URL"
            config.secondaryText = snap.hasFallbackUrl ? "configured" : "none"
        default: break
        }
    }

    private func configureAudioSessionCell(_ config: inout UIListContentConfiguration, row: Int) {
        let snap = sessionSnapshot ?? dataProvider.audioSessionSnapshot()
        switch row {
        case 0:
            config.text = "Category"
            config.secondaryText = snap.category
        case 1:
            config.text = "Mode"
            config.secondaryText = snap.mode
        case 2:
            config.text = "Output Volume"
            config.secondaryText = String(format: "%.0f%%", snap.outputVolume * 100)
        case 3:
            config.text = "Sample Rate"
            config.secondaryText = String(format: "%.0f Hz", snap.sampleRate)
        case 4:
            config.text = "Output Latency"
            config.secondaryText = String(format: "%.1f ms", snap.outputLatency * 1000)
        case 5:
            config.text = "Memory"
            config.secondaryText = String(format: "%.1f MB", memoryMB)
        default: break
        }
    }

    private func configureLogCell(_ config: inout UIListContentConfiguration, row: Int) {
        guard !logEntries.isEmpty else {
            config.text = "No log entries"
            config.textProperties.color = .secondaryLabel
            return
        }
        let entry = logEntries[row]
        let formatter = Self.timeFormatter
        let time = formatter.string(from: entry.timestamp)
        let src = entry.source.isEmpty ? "" : "[\(entry.source)] "
        config.text = "\(time) \(entry.level.rawValue.uppercased())"
        config.secondaryText = "\(src)\(entry.message)"
        config.secondaryTextProperties.numberOfLines = 3

        switch entry.level {
        case .error: config.textProperties.color = .systemRed
        case .warn: config.textProperties.color = .systemOrange
        case .debug: config.textProperties.color = .secondaryLabel
        case .info: config.textProperties.color = .label
        }
    }

    private static let timeFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "HH:mm:ss.SSS"
        return f
    }()

    public func tableView(_ tableView: UITableView, viewForFooterInSection section: Int) -> UIView? {
        guard Section(rawValue: section) == .logs, !logEntries.isEmpty else { return nil }
        let button = UIButton(type: .system)
        button.setTitle("Clear Logs", for: .normal)
        button.addTarget(self, action: #selector(clearLogsTapped), for: .touchUpInside)
        let container = UIView()
        button.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(button)
        NSLayoutConstraint.activate([
            button.centerXAnchor.constraint(equalTo: container.centerXAnchor),
            button.topAnchor.constraint(equalTo: container.topAnchor, constant: 8),
            button.bottomAnchor.constraint(equalTo: container.bottomAnchor, constant: -8),
        ])
        return container
    }

    @objc private func clearLogsTapped() {
        NativeLogger.shared.clear()
        refreshData()
    }
}

