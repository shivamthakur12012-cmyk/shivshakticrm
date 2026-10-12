//
//  ArthoVistaCRMSyncApp.swift
//  ArthoVistaCRMSync
//
//  Created for Artho Vista CRM Mobile Sync Companion (iOS)
//

import SwiftUI

@main
struct ArthoVistaCRMSyncApp: App {
    @StateObject private var callManager = CallObserverManager.shared
    @StateObject private var api = APIService.shared
    
    var body: some Scene {
        WindowGroup {
            ContentView()
                .preferredColorScheme(.dark)
                .onOpenURL { url in
                    handleIncomingURL(url)
                }
        }
    }
    
    private func handleIncomingURL(_ url: URL) {
        // Support deep link formats: arthovista://dial?phone=1234567890&name=John
        guard url.scheme == "arthovista" else { return }
        
        let components = URLComponents(url: url, resolvingAgainstBaseURL: false)
        let phone = components?.queryItems?.first(where: { $0.name == "phone" })?.value
        let name = components?.queryItems?.first(where: { $0.name == "name" })?.value
        
        if let phone = phone, !phone.isEmpty {
            callManager.initiateCall(phoneNumber: phone, contactName: name)
        }
    }
}
