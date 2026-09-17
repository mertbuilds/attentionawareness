import SwiftUI

struct ContentView: View {
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

            Text("Devices connected: \(DeviceProbe.connectedDeviceCount())")
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }
}
