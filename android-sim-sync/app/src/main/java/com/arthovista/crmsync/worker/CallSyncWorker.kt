package com.arthovista.crmsync.worker

import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.provider.CallLog
import android.util.Log
import androidx.core.content.ContextCompat
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.arthovista.crmsync.api.ApiClient
import com.arthovista.crmsync.models.CallLogItem
import com.arthovista.crmsync.models.SyncRequest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class CallSyncWorker(
    private val context: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(context, workerParams) {

    companion object {
        const val TAG = "CallSyncWorker"

        /**
         * Direct execution of SIM call sync without waiting for WorkManager scheduling delays.
         * Can be called directly by CallReceiver (goAsync) or ContentObserver for instant sync.
         */
        suspend fun performDirectSync(context: Context, isManual: Boolean = false): Boolean = withContext(Dispatchers.IO) {
            val prefs = context.getSharedPreferences("crm_sync_prefs", Context.MODE_PRIVATE)
            val token = prefs.getString("auth_token", null)
            val orgId = prefs.getString("org_id", null)
            val autoSync = prefs.getBoolean("auto_sync", true)

            if (token.isNullOrEmpty()) {
                val msg = "⚠️ Missing authentication token. Please log in to connect."
                Log.d(TAG, msg)
                prefs.edit().putString("last_sync_status", msg).apply()
                return@withContext false
            }

            if (!autoSync && !isManual) {
                val msg = "Auto-sync disabled. Tap 'Sync Calls Now' to sync manually."
                Log.d(TAG, msg)
                prefs.edit().putString("last_sync_status", msg).apply()
                return@withContext false
            }

            if (ContextCompat.checkSelfPermission(context, android.Manifest.permission.READ_CALL_LOG) != PackageManager.PERMISSION_GRANTED) {
                val msg = "⚠️ READ_CALL_LOG permission not granted."
                Log.w(TAG, msg)
                prefs.edit().putString("last_sync_status", msg).apply()
                return@withContext false
            }

            val now = System.currentTimeMillis()
            val lastSyncTime = prefs.getLong("last_sync_timestamp", 0L)
            val querySince = if (isManual || lastSyncTime <= 0 || lastSyncTime > now) {
                now - (48 * 60 * 60 * 1000L)
            } else {
                Math.max(lastSyncTime - (10 * 60 * 1000L), now - (48 * 60 * 60 * 1000L))
            }

            val newCalls = fetchRecentCalls(context, querySince)

            if (newCalls.isEmpty()) {
                val timeStr = java.text.SimpleDateFormat("HH:mm:ss", java.util.Locale.getDefault()).format(java.util.Date())
                val msg = "✓ Checked at $timeStr: No recent SIM calls found."
                Log.d(TAG, msg)
                prefs.edit().putString("last_sync_status", msg).apply()
                return@withContext true
            }

            Log.d(TAG, "Found ${newCalls.size} recent call(s) to sync to CRM.")

            return@withContext try {
                val deviceModel = "${Build.MANUFACTURER} ${Build.MODEL} (SIM)"
                val request = SyncRequest(deviceName = deviceModel, callLogs = newCalls)
                val api = ApiClient.getClient(context)
                val response = api.syncCallLogs("Bearer $token", orgId ?: "", request)

                if (response.isSuccessful && response.body()?.success == true) {
                    val maxTimestamp = newCalls.maxOfOrNull { it.timestamp } ?: System.currentTimeMillis()
                    val syncedCount = newCalls.size

                    val timeStr = java.text.SimpleDateFormat("HH:mm:ss", java.util.Locale.getDefault()).format(java.util.Date())
                    val msg = "✓ Synced $syncedCount call(s) to CRM at $timeStr"

                    prefs.edit()
                        .putLong("last_sync_timestamp", maxTimestamp)
                        .putString("last_sync_status", msg)
                        .apply()

                    Log.i(TAG, msg)
                    true
                } else {
                    val err = response.errorBody()?.string() ?: "Server rejected sync"
                    val msg = "Sync failed ($err)"
                    Log.e(TAG, msg)
                    prefs.edit().putString("last_sync_status", msg).apply()
                    false
                }
            } catch (e: Exception) {
                val msg = "Sync connection error: ${e.localizedMessage}"
                Log.e(TAG, msg, e)
                prefs.edit().putString("last_sync_status", msg).apply()
                false
            }
        }

        fun fetchRecentCalls(context: Context, sinceTimestamp: Long): List<CallLogItem> {
            val callList = mutableListOf<CallLogItem>()

            val projection = arrayOf(
                CallLog.Calls.NUMBER,
                CallLog.Calls.CACHED_NAME,
                CallLog.Calls.TYPE,
                CallLog.Calls.DATE,
                CallLog.Calls.DURATION
            )

            val sortOrder = "${CallLog.Calls.DATE} DESC"

            try {
                val cursor = context.contentResolver.query(
                    CallLog.Calls.CONTENT_URI,
                    projection,
                    null,
                    null,
                    sortOrder
                )

                cursor?.use {
                    val numberIndex = it.getColumnIndex(CallLog.Calls.NUMBER)
                    val nameIndex = it.getColumnIndex(CallLog.Calls.CACHED_NAME)
                    val typeIndex = it.getColumnIndex(CallLog.Calls.TYPE)
                    val dateIndex = it.getColumnIndex(CallLog.Calls.DATE)
                    val durationIndex = it.getColumnIndex(CallLog.Calls.DURATION)

                    while (it.moveToNext() && callList.size < 50) {
                        val number = if (numberIndex >= 0) it.getString(numberIndex) else ""
                        val name = if (nameIndex >= 0) it.getString(nameIndex) else null
                        val typeInt = if (typeIndex >= 0) it.getInt(typeIndex) else CallLog.Calls.OUTGOING_TYPE
                        val timestamp = if (dateIndex >= 0) it.getLong(dateIndex) else System.currentTimeMillis()
                        val duration = if (durationIndex >= 0) it.getLong(durationIndex) else 0L

                        if (timestamp < sinceTimestamp && callList.isNotEmpty()) {
                            break
                        }

                        if (!number.isNullOrBlank()) {
                            val callType = when (typeInt) {
                                CallLog.Calls.INCOMING_TYPE -> "INCOMING"
                                CallLog.Calls.OUTGOING_TYPE -> "OUTGOING"
                                CallLog.Calls.MISSED_TYPE -> "MISSED"
                                CallLog.Calls.REJECTED_TYPE -> "REJECTED"
                                else -> "OUTGOING"
                            }

                            callList.add(
                                CallLogItem(
                                    phoneNumber = number.trim(),
                                    contactName = name,
                                    callType = callType,
                                    duration = duration,
                                    timestamp = timestamp,
                                    simSlot = 1
                                )
                            )
                        }
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error querying CallLog:", e)
            }

            return callList
        }
    }

    override suspend fun doWork(): Result {
        val isManual = tags.contains("MANUAL_SYNC")
        val success = performDirectSync(context, isManual)
        return if (success) Result.success() else Result.retry()
    }
}
