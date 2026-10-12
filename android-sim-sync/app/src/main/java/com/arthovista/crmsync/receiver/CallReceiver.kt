package com.arthovista.crmsync.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.telephony.TelephonyManager
import android.util.Log
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import com.arthovista.crmsync.worker.CallSyncWorker
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.util.concurrent.TimeUnit

class CallReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "CallReceiver"
    }

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == TelephonyManager.ACTION_PHONE_STATE_CHANGED) {
            val stateStr = intent.getStringExtra(TelephonyManager.EXTRA_STATE)
            Log.d(TAG, "Phone state changed: $stateStr")

            if (stateStr == TelephonyManager.EXTRA_STATE_IDLE) {
                Log.d(TAG, "Call ended/idle. Starting immediate direct sync with duration verification...")

                val pendingResult = goAsync()
                val appContext = context.applicationContext

                CoroutineScope(Dispatchers.IO).launch {
                    try {
                        // 1. Initial 1.8s delay: Allows Android OS / Carrier RIL to write the completed call & exact duration
                        delay(1800)
                        Log.d(TAG, "Executing immediate direct sync (pass 1)...")
                        CallSyncWorker.performDirectSync(appContext, isManual = false)

                        // 2. Secondary confirmation after 3.2s (5.0s total): Catches any delayed carrier duration commit
                        delay(3200)
                        Log.d(TAG, "Executing confirmation sync (pass 2)...")
                        CallSyncWorker.performDirectSync(appContext, isManual = false)
                    } catch (e: Exception) {
                        Log.e(TAG, "Error in direct background call sync: ${e.message}", e)
                    } finally {
                        pendingResult.finish()
                    }
                }

                // Backup fallback WorkManager request in case OS interrupts Broadcast coroutine
                val fallbackRequest = OneTimeWorkRequestBuilder<CallSyncWorker>()
                    .setInitialDelay(5, TimeUnit.SECONDS)
                    .build()

                WorkManager.getInstance(context).enqueueUniqueWork(
                    "CALL_SYNC_FALLBACK",
                    ExistingWorkPolicy.REPLACE,
                    fallbackRequest
                )
            }
        }
    }
}
