package com.arthovista.crmsync.models

import com.google.gson.annotations.SerializedName

data class CallLogItem(
    @SerializedName("phoneNumber") val phoneNumber: String,
    @SerializedName("contactName") val contactName: String? = null,
    @SerializedName("callType") val callType: String, // INCOMING, OUTGOING, MISSED, REJECTED
    @SerializedName("duration") val duration: Long, // seconds
    @SerializedName("timestamp") val timestamp: Long, // unix ms
    @SerializedName("notes") val notes: String? = null,
    @SerializedName("simSlot") val simSlot: Int = 1
)

data class SyncRequest(
    @SerializedName("deviceName") val deviceName: String,
    @SerializedName("callLogs") val callLogs: List<CallLogItem>
)

data class SyncResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("message") val message: String,
    @SerializedName("data") val data: Any? = null
)

data class LoginRequest(
    @SerializedName("email") val email: String,
    @SerializedName("password") val password: String
)

data class LoginResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("message") val message: String?,
    @SerializedName("data") val data: LoginData?
)

data class LoginData(
    @SerializedName("token") val token: String,
    @SerializedName("user") val user: UserInfo,
    @SerializedName("organizations") val organizations: List<OrgInfo>
)

data class UserInfo(
    @SerializedName("id") val id: String,
    @SerializedName("firstName") val firstName: String,
    @SerializedName("lastName") val lastName: String,
    @SerializedName("email") val email: String
)

data class OrgInfo(
    @SerializedName("id") val id: String,
    @SerializedName("name") val name: String,
    @SerializedName("role") val role: String
)
