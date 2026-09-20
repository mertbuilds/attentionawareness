import SwiftUI

/// The window in demo mode: the wizard exactly as it ships, with the demo's
/// own bar under it.
///
/// The bar is the only thing on screen that is not the product. It is always
/// labelled, and it is only ever built behind the hidden `--demo` flag.
struct DemoWindow: View {
    @StateObject private var model: DemoWizardModel

    init(model: DemoWizardModel) {
        _model = StateObject(wrappedValue: model)
    }

    var body: some View {
        VStack(spacing: 0) {
            ContentView(demo: model)
                .frame(minWidth: 760, minHeight: 520)
            Divider()
            DemoBar(model: model)
        }
    }
}

/// The demo controls: jump to any step, and say what the wizard finds when it
/// looks at the world.
struct DemoBar: View {
    @ObservedObject var model: DemoWizardModel

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            heading
            steps
            Divider()
            world
            switches
        }
        .font(.caption)
        .controlSize(.small)
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(nsColor: .underPageBackgroundColor))
    }

    /// What this bar is, said plainly, so it can never be read as part of the
    /// product.
    private var heading: some View {
        HStack(spacing: 8) {
            Text("Demo")
                .foregroundStyle(.white)
                .padding(.horizontal, 7)
                .padding(.vertical, 2)
                .background(WizardStyle.accent, in: Capsule())
            Text(
                "Nothing here touches an iPhone. "
                    + "A transfer runs in about twenty five seconds, and one second of it "
                    + "stands for about two minutes on the cable."
            )
            .foregroundStyle(.secondary)
            Spacer(minLength: 12)
            Button("Reset") {
                model.reset()
            }
        }
    }

    /// The step the window is on. Picking one lands on it without walking the
    /// steps before it.
    private var steps: some View {
        field("Step") {
            Picker("Step", selection: stepBinding) {
                ForEach(WizardStep.allCases, id: \.self) { step in
                    Text(step.title).tag(step)
                }
            }
            .pickerStyle(.segmented)
            .labelsHidden()
        }
    }

    /// What the wizard finds when it reads the world, and how the next piece
    /// of work ends.
    private var world: some View {
        HStack(alignment: .bottom, spacing: 18) {
            field("iPhones") {
                Picker("iPhones", selection: $model.conditions.phones) {
                    ForEach(DemoConditions.Phones.allCases) { phones in
                        Text(phones.title).tag(phones)
                    }
                }
                .pickerStyle(.segmented)
                .labelsHidden()
                .frame(width: 150)
            }
            field("iCloud backups") {
                Picker("iCloud backups", selection: $model.conditions.cloudBackups) {
                    ForEach(DemoConditions.CloudBackups.allCases) { backups in
                        Text(backups.title).tag(backups)
                    }
                }
                .pickerStyle(.segmented)
                .labelsHidden()
                .frame(width: 180)
            }
            field("Finder backups") {
                Picker("Finder backups", selection: $model.conditions.finderBackups) {
                    ForEach(DemoConditions.FinderBackups.allCases) { backups in
                        Text(backups.title).tag(backups)
                    }
                }
                .pickerStyle(.segmented)
                .labelsHidden()
                .frame(width: 230)
            }
            field("Next job") {
                Picker("Next job", selection: $model.conditions.outcome) {
                    ForEach(DemoConditions.Outcome.allCases) { outcome in
                        Text(outcome.title).tag(outcome)
                    }
                }
                .pickerStyle(.segmented)
                .labelsHidden()
                .frame(width: 220)
            }
            Spacer(minLength: 0)
        }
    }

    /// The switches a step reads one way or the other.
    private var switches: some View {
        HStack(alignment: .center, spacing: 18) {
            Toggle("Find My on", isOn: $model.conditions.findMyOn)
            Toggle("Encrypted backups", isOn: $model.conditions.backupsEncrypted)
            Toggle("Already supervised", isOn: $model.conditions.supervised)
            Toggle("Profile installed", isOn: $model.conditions.profileInstalled)
            Toggle("Backup on this Mac", isOn: $model.conditions.holdingBackup)
            Spacer(minLength: 0)
        }
        .toggleStyle(.checkbox)
        .tint(WizardStyle.accent)
    }

    /// The step picker reads the window and writes a jump, so it follows the
    /// wizard when a button moves it as well.
    private var stepBinding: Binding<WizardStep> {
        Binding(
            get: { model.step },
            set: { model.jump(to: $0) }
        )
    }

    /// One control with its name over it, which is what keeps a row of them
    /// inside the window at any width.
    private func field(_ name: String, @ViewBuilder content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(name)
                .foregroundStyle(.secondary)
            content()
        }
    }
}
