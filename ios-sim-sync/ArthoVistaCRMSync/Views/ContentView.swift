//
//  ContentView.swift
//  ArthoVistaCRMSync
//
//  Created for Artho Vista CRM Mobile Sync Companion (iOS)
//

import SwiftUI

struct ContentView: View {
    @ObservedObject var api = APIService.shared
    @ObservedObject var callManager = CallObserverManager.shared
    
    // Auth Form State
    @State private var email: String = ""
    @State private var password: String = ""
    @State private var serverUrl: String = ""
    @State private var isLoading: Bool = false
    @State private var authErrorMessage: String?
    
    // Leads / Dialing State
    @State private var leads: [LeadItem] = []
    @State private var searchQuery: String = ""
    @State private var isFetchingLeads: Bool = false
    @State private var customPhoneNumber: String = ""
    
    // Quick Note Dialog
    @State private var postCallNote: String = ""
    @State private var selectedTab: Int = 0 // 0: Leads & Dial, 1: Call Logs & Queue, 2: Settings
    
    var body: some View {
        Group {
            if api.authToken == nil {
                loginView
            } else {
                mainDashboardView
            }
        }
        .sheet(isPresented: $callManager.showPostCallPrompt) {
            postCallSheet
        }
        .onAppear {
            serverUrl = api.serverUrl
        }
    }
    
    // MARK: - Login View
    private var loginView: some View {
        NavigationView {
            ZStack {
                LinearGradient(
                    gradient: Gradient(colors: [Color(hex: "0f172a"), Color(hex: "1e293b")]),
                    startPoint: .top,
                    endPoint: .bottom
                )
                .ignoresSafeArea()
                
                ScrollView {
                    VStack(spacing: 24) {
                        // App Logo & Badge
                        VStack(spacing: 10) {
                            ZStack {
                                Circle()
                                    .fill(LinearGradient(colors: [Color.emerald500, Color.teal600], startPoint: .topLeading, endPoint: .bottomTrailing))
                                    .frame(width: 84, height: 84)
                                    .shadow(color: Color.emerald500.opacity(0.4), radius: 16, x: 0, y: 8)
                                
                                Image(systemName: "phone.bubble.left.fill")
                                    .font(.system(size: 38, weight: .bold))
                                    .foregroundColor(.white)
                            }
                            .padding(.top, 40)
                            
                            Text("Artho Vista CRM")
                                .font(.system(size: 26, weight: .black, design: .rounded))
                                .foregroundColor(.white)
                            
                            HStack(spacing: 6) {
                                Text("iOS SIM CALL COMPANION")
                                    .font(.system(size: 11, weight: .bold))
                                    .foregroundColor(Color.emerald400)
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 4)
                                    .background(Color.emerald500.opacity(0.15))
                                    .cornerRadius(20)
                                
                                Text("₹0 TELEPHONY")
                                    .font(.system(size: 11, weight: .black))
                                    .foregroundColor(Color.blue400)
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 4)
                                    .background(Color.blue500.opacity(0.15))
                                    .cornerRadius(20)
                            }
                        }
                        
                        // Login Card
                        VStack(spacing: 18) {
                            VStack(alignment: .leading, spacing: 6) {
                                Text("CRM SERVER URL")
                                    .font(.system(size: 11, weight: .heavy))
                                    .foregroundColor(Color.slate400)
                                
                                TextField("http://10.47.22.247:5000", text: $serverUrl)
                                    .padding(14)
                                    .background(Color(hex: "0f172a"))
                                    .cornerRadius(12)
                                    .foregroundColor(.white)
                                    .autocapitalization(.none)
                                    .disableAutocorrection(true)
                                    .font(.system(size: 14, design: .monospaced))
                            }
                            
                            VStack(alignment: .leading, spacing: 6) {
                                Text("EMPLOYEE EMAIL")
                                    .font(.system(size: 11, weight: .heavy))
                                    .foregroundColor(Color.slate400)
                                
                                TextField("agent@arthovista.com", text: $email)
                                    .padding(14)
                                    .background(Color(hex: "0f172a"))
                                    .cornerRadius(12)
                                    .foregroundColor(.white)
                                    .autocapitalization(.none)
                                    .keyboardType(.emailAddress)
                                    .disableAutocorrection(true)
                                    .font(.system(size: 15))
                            }
                            
                            VStack(alignment: .leading, spacing: 6) {
                                Text("PASSWORD")
                                    .font(.system(size: 11, weight: .heavy))
                                    .foregroundColor(Color.slate400)
                                
                                SecureField("••••••••", text: $password)
                                    .padding(14)
                                    .background(Color(hex: "0f172a"))
                                    .cornerRadius(12)
                                    .foregroundColor(.white)
                                    .font(.system(size: 15))
                            }
                            
                            if let err = authErrorMessage {
                                HStack(spacing: 8) {
                                    Image(systemName: "exclamationmark.triangle.fill")
                                        .foregroundColor(.red)
                                    Text(err)
                                        .font(.system(size: 12, weight: .semibold))
                                        .foregroundColor(.red)
                                }
                                .padding(10)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .background(Color.red.opacity(0.1))
                                .cornerRadius(10)
                            }
                            
                            Button(action: handleLogin) {
                                HStack(spacing: 8) {
                                    if isLoading {
                                        ProgressView()
                                            .progressViewStyle(CircularProgressViewStyle(tint: .white))
                                    } else {
                                        Image(systemName: "lock.open.fill")
                                            .font(.system(size: 15, weight: .bold))
                                        Text("Connect & Login")
                                            .font(.system(size: 16, weight: .bold))
                                    }
                                }
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 16)
                                .background(
                                    LinearGradient(colors: [Color.emerald500, Color.emerald600], startPoint: .leading, endPoint: .trailing)
                                )
                                .foregroundColor(.white)
                                .cornerRadius(14)
                                .shadow(color: Color.emerald500.opacity(0.35), radius: 10, x: 0, y: 5)
                            }
                            .disabled(isLoading || email.isEmpty || password.isEmpty)
                            .opacity((email.isEmpty || password.isEmpty) ? 0.6 : 1.0)
                        }
                        .padding(22)
                        .background(Color(hex: "1e293b"))
                        .cornerRadius(24)
                        .shadow(color: Color.black.opacity(0.3), radius: 20, x: 0, y: 10)
                        .padding(.horizontal, 20)
                        
                        Text("Connects directly with your regular iPhone cellular SIM to record call logs without cloud telephony fees.")
                            .font(.system(size: 12))
                            .foregroundColor(Color.slate400)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 32)
                    }
                    .padding(.bottom, 30)
                }
            }
            .navigationBarHidden(true)
        }
    }
    
    // MARK: - Main Dashboard View
    private var mainDashboardView: some View {
        NavigationView {
            ZStack {
                Color(hex: "0b0f19").ignoresSafeArea()
                
                VStack(spacing: 0) {
                    // Top App Header
                    headerView
                    
                    // Live Call Active Banner (if a call is ongoing)
                    if callManager.isCallActive {
                        liveCallActiveBanner
                    }
                    
                    // Tab Content
                    TabView(selection: $selectedTab) {
                        leadsAndDialerView
                            .tabItem {
                                Label("Leads & Call", systemImage: "phone.badge.plus")
                            }
                            .tag(0)
                        
                        syncLogsView
                            .tabItem {
                                Label("Sync Queue", systemImage: "arrow.triangle.2.circlepath")
                            }
                            .badge(callManager.offlineQueue.count)
                            .tag(1)
                        
                        settingsView
                            .tabItem {
                                Label("Settings", systemImage: "gearshape.fill")
                            }
                            .tag(2)
                    }
                    .accentColor(Color.emerald500)
                }
            }
            .navigationBarHidden(true)
        }
        .onAppear {
            Task {
                await loadLeads()
            }
        }
    }
    
    // MARK: - Top Header
    private var headerView: some View {
        HStack(spacing: 12) {
            ZStack {
                Circle()
                    .fill(Color.emerald500.opacity(0.2))
                    .frame(width: 42, height: 42)
                Image(systemName: "antenna.radiowaves.left.and.right")
                    .font(.system(size: 18, weight: .bold))
                    .foregroundColor(Color.emerald400)
            }
            
            VStack(alignment: .leading, spacing: 2) {
                Text(api.currentUser?.fullName ?? "Sales Agent")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundColor(.white)
                
                HStack(spacing: 6) {
                    Circle()
                        .fill(Color.emerald500)
                        .frame(width: 7, height: 7)
                    Text("SIM Sync Active")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundColor(Color.emerald400)
                    
                    if let org = api.organizations.first(where: { $0.id == api.selectedOrgId }) {
                        Text("• \(org.name)")
                            .font(.system(size: 11))
                            .foregroundColor(Color.slate400)
                            .lineLimit(1)
                    }
                }
            }
            
            Spacer()
            
            Button(action: {
                Task {
                    await callManager.syncPendingCalls()
                }
            }) {
                ZStack {
                    RoundedRectangle(cornerRadius: 10)
                        .fill(Color(hex: "1e293b"))
                    Image(systemName: "arrow.clockwise")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundColor(Color.emerald400)
                        .rotationEffect(.degrees(callManager.isSyncing ? 360 : 0))
                        .animation(callManager.isSyncing ? Animation.linear(duration: 1).repeatForever(autoreverses: false) : .default, value: callManager.isSyncing)
                }
                .frame(width: 36, height: 36)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(Color(hex: "111827"))
    }
    
    // MARK: - Live Active Call Banner
    private var liveCallActiveBanner: some View {
        HStack(spacing: 12) {
            ZStack {
                Circle()
                    .fill(Color.emerald500)
                    .frame(width: 34, height: 34)
                Image(systemName: "phone.fill")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundColor(.white)
            }
            
            VStack(alignment: .leading, spacing: 2) {
                Text("CALL IN PROGRESS")
                    .font(.system(size: 10, weight: .black))
                    .foregroundColor(Color.emerald400)
                
                Text(callManager.activeCallContact.isEmpty ? callManager.activeCallPhone : callManager.activeCallContact)
                    .font(.system(size: 14, weight: .bold))
                    .foregroundColor(.white)
            }
            
            Spacer()
            
            Text(formatDuration(callManager.activeCallDurationSeconds))
                .font(.system(size: 16, weight: .black, design: .monospaced))
                .foregroundColor(Color.emerald400)
                .padding(.horizontal, 10)
                .padding(.vertical, 4)
                .background(Color.emerald950.opacity(0.6))
                .cornerRadius(8)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(Color.emerald900.opacity(0.3))
        .overlay(
            Rectangle()
                .frame(height: 1)
                .foregroundColor(Color.emerald500.opacity(0.3)),
            alignment: .bottom
        )
    }
    
    // MARK: - Tab 0: Leads & Dialer
    private var leadsAndDialerView: some View {
        VStack(spacing: 14) {
            // Quick Custom Dialer Bar
            HStack(spacing: 8) {
                Image(systemName: "phone.arrow.up.right")
                    .foregroundColor(Color.slate400)
                
                TextField("Enter phone to dial (e.g. 9876543210)...", text: $customPhoneNumber)
                    .keyboardType(.phonePad)
                    .foregroundColor(.white)
                    .font(.system(size: 14))
                
                if !customPhoneNumber.isEmpty {
                    Button(action: {
                        callManager.initiateCall(phoneNumber: customPhoneNumber)
                    }) {
                        Image(systemName: "phone.fill")
                            .font(.system(size: 13, weight: .bold))
                            .foregroundColor(.white)
                            .padding(8)
                            .background(Color.emerald500)
                            .clipShape(Circle())
                    }
                }
            }
            .padding(12)
            .background(Color(hex: "1e293b"))
            .cornerRadius(14)
            .padding(.horizontal, 16)
            .padding(.top, 12)
            
            // Search Leads
            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                    .foregroundColor(Color.slate400)
                TextField("Search CRM leads by name or phone...", text: $searchQuery)
                    .foregroundColor(.white)
                    .font(.system(size: 13))
                
                if !searchQuery.isEmpty {
                    Button(action: { searchQuery = "" }) {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundColor(Color.slate400)
                    }
                }
            }
            .padding(10)
            .background(Color(hex: "131c2e"))
            .cornerRadius(12)
            .padding(.horizontal, 16)
            
            // Leads List
            if isFetchingLeads {
                Spacer()
                ProgressView("Loading CRM Leads...")
                    .foregroundColor(Color.slate400)
                Spacer()
            } else {
                let filtered = filteredLeads
                if filtered.isEmpty {
                    Spacer()
                    VStack(spacing: 8) {
                        Image(systemName: "person.crop.circle.badge.questionmark")
                            .font(.system(size: 44))
                            .foregroundColor(Color.slate600)
                        Text(searchQuery.isEmpty ? "No Leads Available" : "No Leads Match Query")
                            .font(.system(size: 15, weight: .bold))
                            .foregroundColor(Color.slate300)
                        Text("Pull down or tap refresh to load from CRM server.")
                            .font(.system(size: 12))
                            .foregroundColor(Color.slate500)
                    }
                    Spacer()
                } else {
                    List {
                        ForEach(filtered) { lead in
                            HStack(spacing: 12) {
                                ZStack {
                                    Circle()
                                        .fill(Color.primary600.opacity(0.2))
                                        .frame(width: 40, height: 40)
                                    Text(String(lead.name.prefix(1)).uppercased())
                                        .font(.system(size: 16, weight: .black))
                                        .foregroundColor(Color.primary400)
                                }
                                
                                VStack(alignment: .leading, spacing: 2) {
                                    HStack(spacing: 6) {
                                        Text(lead.name)
                                            .font(.system(size: 15, weight: .bold))
                                            .foregroundColor(.white)
                                        
                                        if let leadCode = lead.leadId {
                                            Text(leadCode)
                                                .font(.system(size: 10, weight: .heavy, design: .monospaced))
                                                .foregroundColor(Color.slate400)
                                                .padding(.horizontal, 4)
                                                .padding(.vertical, 1)
                                                .background(Color.slate800)
                                                .cornerRadius(4)
                                        }
                                    }
                                    
                                    HStack(spacing: 8) {
                                        Text(lead.phone)
                                            .font(.system(size: 12, weight: .medium, design: .monospaced))
                                            .foregroundColor(Color.emerald400)
                                        
                                        if let comp = lead.company, !comp.isEmpty {
                                            Text("• \(comp)")
                                                .font(.system(size: 11))
                                                .foregroundColor(Color.slate400)
                                                .lineLimit(1)
                                        }
                                    }
                                }
                                
                                Spacer()
                                
                                Button(action: {
                                    callManager.initiateCall(phoneNumber: lead.phone, contactName: lead.name)
                                }) {
                                    HStack(spacing: 4) {
                                        Image(systemName: "phone.fill")
                                            .font(.system(size: 12, weight: .bold))
                                        Text("Call")
                                            .font(.system(size: 12, weight: .bold))
                                    }
                                    .padding(.horizontal, 12)
                                    .padding(.vertical, 8)
                                    .background(Color.emerald600)
                                    .foregroundColor(.white)
                                    .cornerRadius(10)
                                    .shadow(color: Color.emerald600.opacity(0.4), radius: 6, x: 0, y: 3)
                                }
                                .buttonStyle(BorderlessButtonStyle())
                            }
                            .padding(.vertical, 4)
                            .listRowBackground(Color(hex: "131c2e"))
                        }
                    }
                    .listStyle(PlainListStyle())
                    .refreshable {
                        await loadLeads()
                    }
                }
            }
        }
    }
    
    // MARK: - Tab 1: Sync Queue & Logs
    private var syncLogsView: some View {
        ScrollView {
            VStack(spacing: 16) {
                // Status Card
                VStack(spacing: 12) {
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("SYNC STATUS")
                                .font(.system(size: 10, weight: .black))
                                .foregroundColor(Color.slate400)
                            Text(callManager.syncMessage)
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundColor(Color.emerald400)
                        }
                        Spacer()
                        
                        Toggle("", isOn: $callManager.autoSyncEnabled)
                            .labelsHidden()
                            .toggleStyle(SwitchToggleStyle(tint: Color.emerald500))
                    }
                    
                    HStack(spacing: 12) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("\(callManager.offlineQueue.count)")
                                .font(.system(size: 22, weight: .black))
                                .foregroundColor(callManager.offlineQueue.isEmpty ? .white : Color.amber400)
                            Text("Pending Sync")
                                .font(.system(size: 11, weight: .bold))
                                .foregroundColor(Color.slate400)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(12)
                        .background(Color(hex: "0f172a"))
                        .cornerRadius(12)
                        
                        VStack(alignment: .leading, spacing: 2) {
                            Text("\(callManager.recentSyncedCalls.count)")
                                .font(.system(size: 22, weight: .black))
                                .foregroundColor(Color.emerald400)
                            Text("Synced Calls")
                                .font(.system(size: 11, weight: .bold))
                                .foregroundColor(Color.slate400)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(12)
                        .background(Color(hex: "0f172a"))
                        .cornerRadius(12)
                    }
                    
                    Button(action: {
                        Task {
                            await callManager.syncPendingCalls()
                        }
                    }) {
                        HStack(spacing: 6) {
                            Image(systemName: "arrow.triangle.2.circlepath")
                            Text("Sync Offline Calls Now")
                                .font(.system(size: 14, weight: .bold))
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .background(Color.emerald600)
                        .foregroundColor(.white)
                        .cornerRadius(10)
                    }
                    .disabled(callManager.offlineQueue.isEmpty || callManager.isSyncing)
                    .opacity(callManager.offlineQueue.isEmpty ? 0.5 : 1.0)
                }
                .padding(16)
                .background(Color(hex: "1e293b"))
                .cornerRadius(18)
                .padding(.horizontal, 16)
                .padding(.top, 12)
                
                // Queued Items
                if !callManager.offlineQueue.isEmpty {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("PENDING QUEUE (\(callManager.offlineQueue.count))")
                            .font(.system(size: 11, weight: .heavy))
                            .foregroundColor(Color.amber400)
                            .padding(.horizontal, 16)
                        
                        ForEach(callManager.offlineQueue) { item in
                            callRow(item: item, isPending: true)
                        }
                    }
                }
                
                // Synced History
                if !callManager.recentSyncedCalls.isEmpty {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("RECENTLY SYNCED (\(callManager.recentSyncedCalls.count))")
                            .font(.system(size: 11, weight: .heavy))
                            .foregroundColor(Color.slate400)
                            .padding(.horizontal, 16)
                        
                        ForEach(callManager.recentSyncedCalls) { item in
                            callRow(item: item, isPending: false)
                        }
                    }
                }
            }
            .padding(.bottom, 24)
        }
    }
    
    private func callRow(item: CallLogItem, isPending: Bool) -> some View {
        HStack(spacing: 12) {
            ZStack {
                Circle()
                    .fill(item.callType == "INCOMING" ? Color.blue500.opacity(0.2) : (item.callType == "MISSED" ? Color.red.opacity(0.2) : Color.emerald500.opacity(0.2)))
                    .frame(width: 36, height: 36)
                Image(systemName: item.callType == "INCOMING" ? "phone.arrow.down.left" : (item.callType == "MISSED" ? "phone.down.left" : "phone.arrow.up.right"))
                    .font(.system(size: 13, weight: .bold))
                    .foregroundColor(item.callType == "INCOMING" ? Color.blue400 : (item.callType == "MISSED" ? Color.red : Color.emerald400))
            }
            
            VStack(alignment: .leading, spacing: 2) {
                Text(item.contactName ?? item.phoneNumber)
                    .font(.system(size: 14, weight: .bold))
                    .foregroundColor(.white)
                
                HStack(spacing: 6) {
                    Text(item.phoneNumber)
                        .font(.system(size: 11, design: .monospaced))
                        .foregroundColor(Color.slate400)
                    
                    if let n = item.notes, !n.isEmpty {
                        Text("• \"\(n)\"")
                            .font(.system(size: 11))
                            .foregroundColor(Color.emerald400)
                            .lineLimit(1)
                    }
                }
            }
            
            Spacer()
            
            VStack(alignment: .trailing, spacing: 2) {
                Text("\(item.duration)s")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundColor(.white)
                
                Text(isPending ? "Queued" : "Synced ✅")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundColor(isPending ? Color.amber400 : Color.emerald400)
            }
        }
        .padding(12)
        .background(Color(hex: "131c2e"))
        .cornerRadius(12)
        .padding(.horizontal, 16)
    }
    
    // MARK: - Tab 2: Settings
    private var settingsView: some View {
        ScrollView {
            VStack(spacing: 18) {
                VStack(alignment: .leading, spacing: 12) {
                    Text("CONNECTED USER")
                        .font(.system(size: 10, weight: .heavy))
                        .foregroundColor(Color.slate400)
                    
                    HStack(spacing: 12) {
                        ZStack {
                            Circle()
                                .fill(Color.emerald500)
                                .frame(width: 44, height: 44)
                            Text(String(api.currentUser?.firstName.prefix(1) ?? "U"))
                                .font(.system(size: 18, weight: .black))
                                .foregroundColor(.white)
                        }
                        
                        VStack(alignment: .leading, spacing: 2) {
                            Text(api.currentUser?.fullName ?? "User")
                                .font(.system(size: 16, weight: .bold))
                                .foregroundColor(.white)
                            Text(api.currentUser?.email ?? "")
                                .font(.system(size: 12))
                                .foregroundColor(Color.slate400)
                        }
                    }
                }
                .padding(16)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color(hex: "1e293b"))
                .cornerRadius(16)
                
                // Organization Selector
                VStack(alignment: .leading, spacing: 10) {
                    Text("ACTIVE ORGANIZATION")
                        .font(.system(size: 10, weight: .heavy))
                        .foregroundColor(Color.slate400)
                    
                    ForEach(api.organizations) { org in
                        Button(action: {
                            api.selectedOrgId = org.id
                            Task { await loadLeads() }
                        }) {
                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(org.name)
                                        .font(.system(size: 14, weight: .bold))
                                        .foregroundColor(.white)
                                    Text("Role: \(org.role)")
                                        .font(.system(size: 11))
                                        .foregroundColor(Color.slate400)
                                }
                                Spacer()
                                if api.selectedOrgId == org.id {
                                    Image(systemName: "checkmark.circle.fill")
                                        .foregroundColor(Color.emerald400)
                                }
                            }
                            .padding(12)
                            .background(api.selectedOrgId == org.id ? Color.emerald950.opacity(0.5) : Color(hex: "0f172a"))
                            .cornerRadius(10)
                        }
                    }
                }
                .padding(16)
                .background(Color(hex: "1e293b"))
                .cornerRadius(16)
                
                // Logout Button
                Button(action: {
                    api.logout()
                }) {
                    HStack(spacing: 6) {
                        Image(systemName: "rectangle.portrait.and.arrow.right")
                        Text("Log Out of CRM")
                            .font(.system(size: 14, weight: .bold))
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(Color.red.opacity(0.15))
                    .foregroundColor(.red)
                    .cornerRadius(12)
                }
            }
            .padding(16)
        }
    }
    
    // MARK: - Post-Call Note Sheet
    private var postCallSheet: some View {
        NavigationView {
            ZStack {
                Color(hex: "0f172a").ignoresSafeArea()
                
                VStack(spacing: 20) {
                    VStack(spacing: 6) {
                        Image(systemName: "phone.badge.checkmark")
                            .font(.system(size: 38))
                            .foregroundColor(Color.emerald400)
                        
                        Text("Call Completed!")
                            .font(.system(size: 20, weight: .black))
                            .foregroundColor(.white)
                        
                        if let call = callManager.lastCompletedCall {
                            Text("\(call.contactName ?? call.phoneNumber) • \(call.duration)s")
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundColor(Color.slate300)
                        }
                    }
                    .padding(.top, 20)
                    
                    // Quick Disposition Tags
                    VStack(alignment: .leading, spacing: 8) {
                        Text("QUICK DISPOSITION NOTE")
                            .font(.system(size: 11, weight: .heavy))
                            .foregroundColor(Color.slate400)
                        
                        let presets = ["Interested in Demo", "Follow Up Later", "Quote Requested", "Wrong Number", "Call Dropped"]
                        LazyVGrid(columns: [GridItem(.adaptive(minimum: 140))], spacing: 8) {
                            ForEach(presets, id: \.self) { preset in
                                Button(action: { postCallNote = preset }) {
                                    Text(preset)
                                        .font(.system(size: 12, weight: .semibold))
                                        .padding(.horizontal, 10)
                                        .padding(.vertical, 8)
                                        .frame(maxWidth: .infinity)
                                        .background(postCallNote == preset ? Color.emerald600 : Color(hex: "1e293b"))
                                        .foregroundColor(.white)
                                        .cornerRadius(8)
                                }
                            }
                        }
                    }
                    .padding(.horizontal, 20)
                    
                    // Custom Note Field
                    VStack(alignment: .leading, spacing: 6) {
                        Text("ADDITIONAL NOTES")
                            .font(.system(size: 11, weight: .heavy))
                            .foregroundColor(Color.slate400)
                        
                        TextField("Type call outcome summary...", text: $postCallNote)
                            .padding(12)
                            .background(Color(hex: "1e293b"))
                            .cornerRadius(10)
                            .foregroundColor(.white)
                    }
                    .padding(.horizontal, 20)
                    
                    Spacer()
                    
                    Button(action: {
                        callManager.updateLastCallNote(note: postCallNote)
                        postCallNote = ""
                        callManager.showPostCallPrompt = false
                    }) {
                        Text("Save & Log Call to CRM")
                            .font(.system(size: 16, weight: .bold))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 16)
                            .background(Color.emerald600)
                            .foregroundColor(.white)
                            .cornerRadius(14)
                    }
                    .padding(.horizontal, 20)
                    .padding(.bottom, 20)
                }
            }
            .navigationBarItems(trailing: Button("Close") {
                callManager.showPostCallPrompt = false
            })
        }
    }
    
    // MARK: - Helper Actions
    private func handleLogin() {
        isLoading = true
        authErrorMessage = nil
        api.serverUrl = serverUrl
        
        Task {
            do {
                _ = try await api.login(request: LoginRequest(email: email, password: password))
                await MainActor.run {
                    self.isLoading = false
                }
                await loadLeads()
            } catch {
                await MainActor.run {
                    self.isLoading = false
                    self.authErrorMessage = error.localizedDescription
                }
            }
        }
    }
    
    private func loadLeads() async {
        await MainActor.run { isFetchingLeads = true }
        do {
            let fetched = try await api.fetchLeads()
            await MainActor.run {
                self.leads = fetched
                self.isFetchingLeads = false
            }
        } catch {
            await MainActor.run {
                self.isFetchingLeads = false
            }
        }
    }
    
    private var filteredLeads: [LeadItem] {
        if searchQuery.isEmpty { return leads }
        let q = searchQuery.lowercased()
        return leads.filter {
            $0.name.lowercased().contains(q) ||
            $0.phone.contains(q) ||
            ($0.company?.lowercased().contains(q) ?? false)
        }
    }
    
    private func formatDuration(_ seconds: Int) -> String {
        let m = seconds / 60
        let s = seconds % 60
        return String(format: "%02d:%02d", m, s)
    }
}

// MARK: - Color & Hex Helpers
extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3: // RGB (12-bit)
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6: // RGB (24-bit)
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: // ARGB (32-bit)
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (1, 1, 1, 0)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue:  Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
    
    static let emerald400 = Color(hex: "34d399")
    static let emerald500 = Color(hex: "10b981")
    static let emerald600 = Color(hex: "059669")
    static let emerald900 = Color(hex: "064e3b")
    static let emerald950 = Color(hex: "022c22")
    static let blue400 = Color(hex: "60a5fa")
    static let blue500 = Color(hex: "3b82f6")
    static let amber400 = Color(hex: "fbbf24")
    static let primary400 = Color(hex: "818cf8")
    static let primary600 = Color(hex: "4f46e5")
    static let slate300 = Color(hex: "cbd5e1")
    static let slate400 = Color(hex: "94a3b8")
    static let slate500 = Color(hex: "64748b")
    static let slate600 = Color(hex: "475569")
    static let slate800 = Color(hex: "1e293b")
}
