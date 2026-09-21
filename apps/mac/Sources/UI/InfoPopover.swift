import AVKit
import SwiftUI

/// What the "i" opens: the film where one has been recorded, and the words
/// under it.
///
/// It is a view of its own rather than the body of the popover so that
/// `--ui-smoke` can draw it, which is the only way to see it from a terminal.
struct InfoPopoverContent: View {
    let text: String
    var video: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            if let video, let url = InfoVideo.url(named: video) {
                LoopingVideo(url: url)
            }
            Text(text)
                .font(.callout)
                .fixedSize(horizontal: false, vertical: true)
                .frame(width: 280, alignment: .leading)
        }
        .padding(12)
    }
}

/// A screen recording of an iPhone, playing itself.
///
/// Portrait, the shape of the phone it was taken on, muted, and it starts
/// again as soon as it ends. There is nothing to press: the answer is a few
/// seconds long and the other hand is holding a phone. The slot is the same
/// size whatever the recording is, and the player fits the film inside it.
struct LoopingVideo: View {
    /// The shape of a phone held upright, which is what every one of these is.
    private static let size = CGSize(width: 220, height: 476)

    let url: URL

    @State private var player: AVQueuePlayer?
    /// The loop plays only as long as something holds it, so this is held.
    @State private var looper: AVPlayerLooper?

    var body: some View {
        VideoPlayer(player: player)
            .frame(width: Self.size.width, height: Self.size.height)
            .clipShape(RoundedRectangle(cornerRadius: WizardStyle.cardRadius))
            .onAppear(perform: start)
            .onDisappear { player?.pause() }
    }

    private func start() {
        guard player == nil else { return }
        let queue = AVQueuePlayer()
        queue.isMuted = true
        looper = AVPlayerLooper(player: queue, templateItem: AVPlayerItem(url: url))
        player = queue
        queue.play()
    }
}
