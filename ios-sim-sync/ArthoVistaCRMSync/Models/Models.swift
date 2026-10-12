//
//  Models.swift
//  ArthoVistaCRMSync
//
//  Created for Artho Vista CRM Mobile Sync Companion (iOS)
//

import Foundation

// MARK: - Call Log Item
public struct CallLogItem: Codable, Identifiable, Equatable {
    public var id: String { "\(phoneNumber)_\(timestamp)" }
    
    public let phoneNumber: String
    public let contactName: String?
    public let callType: String // INCOMING, OUTGOING, MISSED, REJECTED
    public let duration: Int64 // in seconds
    public let timestamp: Int64 // unix timestamp in milliseconds
    public var notes: String?
    public let simSlot: Int
    
    public init(
        phoneNumber: String,
        contactName: String? = nil,
        callType: String = "OUTGOING",
        duration: Int64 = 0,
        timestamp: Int64 = Int64(Date().timeIntervalSince1970 * 1000),
        notes: String? = nil,
        simSlot: Int = 1
    ) {
        self.phoneNumber = phoneNumber
        self.contactName = contactName
        self.callType = callType
        self.duration = duration
        self.timestamp = timestamp
        self.notes = notes
        self.simSlot = simSlot
    }
}

// MARK: - Sync Request & Response
public struct SyncRequest: Codable {
    public let deviceName: String
    public let callLogs: [CallLogItem]
    
    public init(deviceName: String, callLogs: [CallLogItem]) {
        self.deviceName = deviceName
        self.callLogs = callLogs
    }
}

public struct SyncResponse: Codable {
    public let success: Bool
    public let message: String
}

// MARK: - Auth Models
public struct LoginRequest: Codable {
    public let email: String
    public let password: String
    
    public init(email: String, password: String) {
        self.email = email
        self.password = password
    }
}

public struct LoginResponse: Codable {
    public let success: Bool
    public let message: String?
    public let data: LoginData?
}

public struct LoginData: Codable {
    public let token: String
    public let user: UserInfo
    public let organizations: [OrgInfo]
}

public struct UserInfo: Codable {
    public let id: String
    public let firstName: String
    public let lastName: String
    public let email: String
    
    public var fullName: String {
        let name = "\(firstName) \(lastName)".trimmingCharacters(in: .whitespaces)
        return name.isEmpty ? email : name
    }
}

public struct OrgInfo: Codable, Identifiable, Equatable {
    public let id: String
    public let name: String
    public let role: String
}

// MARK: - CRM Lead Model
public struct LeadItem: Codable, Identifiable {
    public let id: String
    public let name: String
    public let phone: String
    public let email: String?
    public let company: String?
    public let status: String?
    public let leadId: String?
    
    enum CodingKeys: String, CodingKey {
        case id = "_id"
        case name
        case phone
        case email
        case company
        case status
        case leadId
    }
}

public struct LeadsResponse: Codable {
    public let success: Bool
    public let data: LeadsDataPayload?
}

public struct LeadsDataPayload: Codable {
    public let leads: [LeadItem]?
}
