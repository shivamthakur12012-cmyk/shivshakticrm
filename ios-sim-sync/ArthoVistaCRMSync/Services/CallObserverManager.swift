//
//  CallObserverManager.swift
//  ArthoVistaCRMSync
//
//  Created for Artho Vista CRM Mobile Sync Companion (iOS)
//

import Foundation
import CallKit
import Combine
import UIKit

public class CallObserverManager: NSObject, ObservableObject, CXCallObserverDelegate {
    public static let shared = CallObserverManager()
    
    private let callObserver = CXCallObserver()
    
    // Published UI States
    @Published public var isCallActive: Bool = false
    @Published public var activeCallDurationSeconds: Int = 0
    @Published public var activeCallPhone: String = ""
    @Published public var activeCallContact: String = ""
    @Published public var isOutgoing: Bool = true
    
    // Post-Call Dialog State
    @Published public var showPostCallPrompt: Bool = false
    @Published public var lastCompletedCall: CallLogItem? = nil
    
    // Call Log Queues
    @Published public var offlineQueue: [CallLogItem] = []
    @Published public var recentSyncedCalls: [CallLogItem] = []
    @Published public var isSyncing: Bool = false
    @Published public var syncMessage: String = "Ready"
    @Published public var autoSyncEnabled: Bool = true {
        didSet {
            UserDefaults.standard.set(autoSyncEnabled, forKey: "crm_auto_sync")
        }
    }
    
    private var callStartTime: Date?
    private var durationTimer: Timer?
    private let queueKey = "crm_offline_call_queue"
    private let historyKey = "crm_synced_call_history"
    
    private override init() {
        super.init()
        self.autoSyncEnabled = UserDefaults.standard.object(forKey: "crm_auto_sync") as? Bool ?? true
        loadQueues()
        callObserver.setDelegate(self, queue: nil)
    }
    
    // MARK: - CXCallObserverDelegate
    public func callObserver(_ callObserver: CXCallObserver, callChanged call: CXCall) {
        DispatchQueue.main.async {
            self.handleCallStateChange(call: call)
        }
    }
    
    private func handleCallStateChange(call: CXCall) {
        if call.hasConnected && !call.hasEnded {
            // Call is actively ongoing
            if !isCallActive {
                isCallActive = true
                callStartTime = Date()
                isOutgoing = call.isOutgoing
                startDurationTimer()
            }
        } else if call.isOutgoing && !call.hasConnected && !call.hasEnded {
            // Outgoing call is dialing
            isCallActive = true
            isOutgoing = true
            if callStartTime == nil {
                callStartTime = Date()
            }
            startDurationTimer()
        } else if call.hasEnded {
            // Call finished
            stopDurationTimer()
            let durationSeconds: Int64
            if let start = callStartTime {
                durationSeconds = Int64(max(0, Date().timeIntervalSince(start)))
            } else {
                durationSeconds = Int64(activeCallDurationSeconds)
            }
            
            let callType: String
            if durationSeconds == 0 {
                callType = isOutgoing ? "MISSED" : "REJECTED"
            } else {
                callType = isOutgoing ? "OUTGOING" : "INCOMING"
            }
            
            let phoneToLog = activeCallPhone.isEmpty ? "Unknown" : activeCallPhone
            let contactToLog = activeCallContact.isEmpty ? nil : activeCallContact
            
            let completedLog = CallLogItem(
                phoneNumber: phoneToLog,
                contactName: contactToLog,
                callType: callType,
                duration: durationSeconds,
                timestamp: Int64(Date().timeIntervalSince1970 * 1000),
                notes: nil,
                simSlot: 1
            )
            
            self.lastCompletedCall = completedLog
            self.showPostCallPrompt = true
            
            // Add to offline queue
            self.addToQueue(completedLog)
            
            // Reset active call tracking
            self.isCallActive = false
            self.activeCallDurationSeconds = 0
            self.callStartTime = nil
            
            // Trigger Auto-Sync if enabled
            if self.autoSyncEnabled && APIService.shared.authToken != nil {
                Task {
                    await self.syncPendingCalls()
                }
            }
        }
    }
    
    // MARK: - 1-Tap Click to Call Action
    public func initiateCall(phoneNumber: String, contactName: String? = nil) {
        let cleanPhone = phoneNumber.components(separatedBy: CharacterSet.decimalDigits.inverted).joined()
        guard let url = URL(string: "tel://\(cleanPhone)"), UIApplication.shared.canOpenURL(url) else {
            self.syncMessage = "Cannot open phone dialer for \(phoneNumber)"
            return
        }
        
        self.activeCallPhone = phoneNumber
        self.activeCallContact = contactName ?? ""
        self.isOutgoing = true
        self.callStartTime = Date()
        self.isCallActive = true
        startDurationTimer()
        
        UIApplication.shared.open(url)
    }
    
    // MARK: - Duration Timer
    private func startDurationTimer() {
        durationTimer?.invalidate()
        activeCallDurationSeconds = 0
        durationTimer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
            guard let self = self else { return }
            if let start = self.callStartTime {
                self.activeCallDurationSeconds = Int(Date().timeIntervalSince(start))
            } else {
                self.activeCallDurationSeconds += 1
            }
        }
    }
    
    private func stopDurationTimer() {
        durationTimer?.invalidate()
        durationTimer = nil
    }
    
    // MARK: - Queue & Persistence
    public func addToQueue(_ item: CallLogItem) {
        offlineQueue.insert(item, at: 0)
        saveQueues()
    }
    
    public func updateLastCallNote(note: String) {
        guard var last = lastCompletedCall else { return }
        last.notes = note
        self.lastCompletedCall = last
        
        // Update in queue
        if let idx = offlineQueue.firstIndex(where: { $0.id == last.id }) {
            offlineQueue[idx].notes = note
            saveQueues()
        }
        
        if autoSyncEnabled {
            Task {
                await syncPendingCalls()
            }
        }
    }
    
    public func syncPendingCalls() async {
        guard !offlineQueue.isEmpty else {
            await MainActor.run {
                self.syncMessage = "All calls up to date ✅"
            }
            return
        }
        
        await MainActor.run {
            self.isSyncing = true
            self.syncMessage = "Syncing \(offlineQueue.count) call(s)..."
        }
        
        do {
            let itemsToSync = Array(offlineQueue)
            let deviceName = "\(UIDevice.current.name) (iOS \(UIDevice.current.systemVersion))"
            let response = try await APIService.shared.syncCallLogs(logs: itemsToSync, deviceName: deviceName)
            
            await MainActor.run {
                self.isSyncing = false
                if response.success {
                    self.syncMessage = "Synced \(itemsToSync.count) call(s) successfully! 🎉"
                    // Move to synced history
                    self.recentSyncedCalls.insert(contentsOf: itemsToSync, at: 0)
                    if self.recentSyncedCalls.count > 50 {
                        self.recentSyncedCalls = Array(self.recentSyncedCalls.prefix(50))
                    }
                    self.offlineQueue.removeAll()
                    self.saveQueues()
                } else {
                    self.syncMessage = "Sync notice: \(response.message)"
                }
            }
        } catch {
            await MainActor.run {
                self.isSyncing = false
                self.syncMessage = "Sync failed: \(error.localizedDescription)"
            }
        }
    }
    
    private func saveQueues() {
        if let queueData = try? JSONEncoder().encode(offlineQueue) {
            UserDefaults.standard.set(queueData, forKey: queueKey)
        }
        if let histData = try? JSONEncoder().encode(recentSyncedCalls) {
            UserDefaults.standard.set(histData, forKey: historyKey)
        }
    }
    
    private func loadQueues() {
        if let queueData = UserDefaults.standard.data(forKey: queueKey),
           let items = try? JSONDecoder().decode([CallLogItem].self, from: queueData) {
            self.offlineQueue = items
        }
        if let histData = UserDefaults.standard.data(forKey: historyKey),
           let items = try? JSONDecoder().decode([CallLogItem].self, from: histData) {
            self.recentSyncedCalls = items
        }
    }
}
