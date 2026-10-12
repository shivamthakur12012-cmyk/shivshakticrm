//
//  APIService.swift
//  ArthoVistaCRMSync
//
//  Created for Artho Vista CRM Mobile Sync Companion (iOS)
//

import Foundation
import Combine

public class APIService: ObservableObject {
    public static let shared = APIService()
    
    @Published public var serverUrl: String {
        didSet {
            UserDefaults.standard.set(serverUrl, forKey: "crm_server_url")
        }
    }
    
    @Published public var authToken: String? {
        didSet {
            UserDefaults.standard.set(authToken, forKey: "crm_auth_token")
        }
    }
    
    @Published public var selectedOrgId: String? {
        didSet {
            UserDefaults.standard.set(selectedOrgId, forKey: "crm_selected_org_id")
        }
    }
    
    @Published public var currentUser: UserInfo?
    @Published public var organizations: [OrgInfo] = []
    
    private init() {
        self.serverUrl = UserDefaults.standard.string(forKey: "crm_server_url") ?? "http://10.47.22.247:5000"
        self.authToken = UserDefaults.standard.string(forKey: "crm_auth_token")
        self.selectedOrgId = UserDefaults.standard.string(forKey: "crm_selected_org_id")
    }
    
    private var cleanBaseUrl: String {
        var url = serverUrl.trimmingCharacters(in: .whitespacesAndNewlines)
        if url.hasSuffix("/") {
            url.removeLast()
        }
        return url
    }
    
    // MARK: - Login
    public func login(request: LoginRequest) async throws -> LoginData {
        guard let url = URL(string: "\(cleanBaseUrl)/api/auth/login") else {
            throw URLError(.badURL)
        }
        
        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = "POST"
        urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        urlRequest.httpBody = try JSONEncoder().encode(request)
        urlRequest.timeoutInterval = 15
        
        let (data, response) = try await URLSession.shared.data(for: urlRequest)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw URLError(.badServerResponse)
        }
        
        if httpResponse.statusCode >= 400 {
            let errorMsg = String(data: data, encoding: .utf8) ?? "Authentication failed (Status \(httpResponse.statusCode))"
            throw NSError(domain: "APIService", code: httpResponse.statusCode, userInfo: [NSLocalizedDescriptionKey: errorMsg])
        }
        
        let decoded = try JSONDecoder().decode(LoginResponse.self, from: data)
        guard decoded.success, let loginData = decoded.data else {
            throw NSError(domain: "APIService", code: -1, userInfo: [NSLocalizedDescriptionKey: decoded.message ?? "Invalid login response"])
        }
        
        await MainActor.run {
            self.authToken = loginData.token
            self.currentUser = loginData.user
            self.organizations = loginData.organizations
            if self.selectedOrgId == nil || !loginData.organizations.contains(where: { $0.id == self.selectedOrgId }) {
                self.selectedOrgId = loginData.organizations.first?.id
            }
        }
        
        return loginData
    }
    
    // MARK: - Sync Call Logs
    public func syncCallLogs(logs: [CallLogItem], deviceName: String = "iPhone") async throws -> SyncResponse {
        guard let token = authToken, !token.isEmpty else {
            throw NSError(domain: "APIService", code: 401, userInfo: [NSLocalizedDescriptionKey: "Not authenticated. Please log in."])
        }
        
        guard let orgId = selectedOrgId, !orgId.isEmpty else {
            throw NSError(domain: "APIService", code: 400, userInfo: [NSLocalizedDescriptionKey: "No organization selected."])
        }
        
        guard let url = URL(string: "\(cleanBaseUrl)/api/mobile-sync/calls") else {
            throw URLError(.badURL)
        }
        
        let syncReq = SyncRequest(deviceName: deviceName, callLogs: logs)
        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = "POST"
        urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        urlRequest.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        urlRequest.setValue(orgId, forHTTPHeaderField: "x-organization-id")
        urlRequest.httpBody = try JSONEncoder().encode(syncReq)
        urlRequest.timeoutInterval = 20
        
        let (data, response) = try await URLSession.shared.data(for: urlRequest)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw URLError(.badServerResponse)
        }
        
        if httpResponse.statusCode >= 400 {
            let errorMsg = String(data: data, encoding: .utf8) ?? "Sync failed (Status \(httpResponse.statusCode))"
            throw NSError(domain: "APIService", code: httpResponse.statusCode, userInfo: [NSLocalizedDescriptionKey: errorMsg])
        }
        
        let decoded = try JSONDecoder().decode(SyncResponse.self, from: data)
        return decoded
    }
    
    // MARK: - Fetch CRM Leads for 1-Tap Calling
    public func fetchLeads() async throws -> [LeadItem] {
        guard let token = authToken, !token.isEmpty,
              let orgId = selectedOrgId, !orgId.isEmpty else {
            return []
        }
        
        guard let url = URL(string: "\(cleanBaseUrl)/api/leads?limit=50") else {
            throw URLError(.badURL)
        }
        
        var urlRequest = URLRequest(url: url)
        urlRequest.httpMethod = "GET"
        urlRequest.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        urlRequest.setValue(orgId, forHTTPHeaderField: "x-organization-id")
        urlRequest.timeoutInterval = 15
        
        let (data, _) = try await URLSession.shared.data(for: urlRequest)
        if let decoded = try? JSONDecoder().decode(LeadsResponse.self, from: data),
           let leads = decoded.data?.leads {
            return leads
        }
        return []
    }
    
    // MARK: - Logout
    public func logout() {
        authToken = nil
        currentUser = nil
        organizations = []
        selectedOrgId = nil
        UserDefaults.standard.removeObject(forKey: "crm_auth_token")
        UserDefaults.standard.removeObject(forKey: "crm_selected_org_id")
    }
}
