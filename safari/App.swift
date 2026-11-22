import SwiftUI

@main
struct DarkSideCoachApp: App {
    var body: some Scene {
        WindowGroup {
            VStack(alignment: .leading, spacing: 16) {
                Text("Dark Side Coach").font(.title.bold())
                if let version = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String {
                    Text("Verze \(version)")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                #if os(macOS)
                Text("Rozšíření zapneš v Safari v Nastavení → Rozšíření.")
                #else
                Text("Rozšíření zapneš v Nastavení → Aplikace → Safari → Rozšíření.")
                #endif
                Text("V Safari povol přístup k rezervacím Dark Side Movement a ke kalendáři v Notion.")
            }
            .padding(32)
            #if os(macOS)
            .frame(minWidth: 420, minHeight: 200)
            #endif
        }
    }
}
