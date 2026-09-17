import SwiftUI

struct ContentView: View {
    @StateObject private var watcher = DeviceWatcher()

    private let steps = [
        "Connect",
        "Checks",
        "Back up",
        "Patch",
        "Restore",
        "Profile",
        "Done",
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Attention Awareness")
                .font(.title2)
                .fontWeight(.semibold)

            VStack(alignment: .leading, spacing: 8) {
                ForEach(steps, id: \.self) { step in
                    Text(step)
                        .font(.body)
                }
            }

            Spacer()

            deviceBlock
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    /// What the phone on the cable says right now. `DeviceWatcher` reads it
    /// again on every connect and disconnect.
    @ViewBuilder
    private var deviceBlock: some View {
        VStack(alignment: .leading, spacing: 4) {
            if let device = watcher.devices.first {
                switch device.pairingState {
                case .paired:
                    pairedLines(for: device)
                case .trustPending:
                    Text(DeviceError.trustPending.localizedDescription)
                case .untrusted:
                    Text(DeviceError.trustDenied.localizedDescription)
                }
            } else {
                Text("Plug in your iPhone with a cable.")
            }

            if let error = watcher.lastError {
                Text(error)
                    .foregroundStyle(.red)
            }
        }
        .font(.footnote)
        .foregroundStyle(.secondary)
    }

    @ViewBuilder
    private func pairedLines(for device: ConnectedDevice) -> some View {
        Text(device.name ?? "iPhone")
        Text(modelLine(for: device))
        Text(device.iosVersion.map { "iOS \($0)" } ?? "iOS version unknown")
        Text("Find My: \(onOff(device.findMyOn))")
        Text("Backup encryption: \(onOff(device.backupEncrypted))")
        Text(supervisionLine(for: device))
    }

    private func modelLine(for device: ConnectedDevice) -> String {
        switch (device.marketingName, device.productType) {
        case (.some(let marketing), .some(let product)):
            return "\(marketing) (\(product))"
        case (.some(let marketing), .none):
            return marketing
        case (.none, .some(let product)):
            return product
        case (.none, .none):
            return "Model unknown"
        }
    }

    private func supervisionLine(for device: ConnectedDevice) -> String {
        guard let configuration = watcher.cloudConfigurations[device.udid] else {
            return "Supervised: unknown"
        }
        guard configuration.isSupervised else {
            return "Supervised: no"
        }
        guard let organization = configuration.organizationName else {
            return "Supervised: yes"
        }
        return "Supervised: yes (\(organization))"
    }

    private func onOff(_ value: Bool?) -> String {
        guard let value else { return "unknown" }
        return value ? "on" : "off"
    }
}
