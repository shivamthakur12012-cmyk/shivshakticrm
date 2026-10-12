package com.arthovista.crmsync

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.database.ContentObserver
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.CallLog
import android.util.Log
import android.view.View
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import com.arthovista.crmsync.api.ApiClient
import com.arthovista.crmsync.databinding.ActivityMainBinding
import com.arthovista.crmsync.models.LoginRequest
import com.arthovista.crmsync.worker.CallSyncWorker
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.concurrent.TimeUnit

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private var callLogObserver: ContentObserver? = null

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val callLogGranted = permissions[Manifest.permission.READ_CALL_LOG] ?: false
        val phoneStateGranted = permissions[Manifest.permission.READ_PHONE_STATE] ?: false

        if (callLogGranted && phoneStateGranted) {
            binding.tvLogOutput.text = "✓ Permissions granted. Real-time SIM sync is active."
            registerCallLogObserver()
            schedulePeriodicSync()
        } else {
            binding.tvLogOutput.text = "⚠️ Please grant Call Log & Phone State permissions to enable SIM sync."
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        try {
            binding = ActivityMainBinding.inflate(layoutInflater)
            setContentView(binding.root)

            val prefs = getSharedPreferences("crm_sync_prefs", Context.MODE_PRIVATE)
            val token = prefs.getString("auth_token", null)
            val userName = prefs.getString("user_name", null)
            val serverUrl = prefs.getString("server_url", "http://192.168.1.6:5000")

            binding.etServerUrl.setText(serverUrl)

            if (!token.isNullOrEmpty()) {
                showLoggedInState(userName ?: "Sales Agent")
            } else {
                showLoggedOutState()
            }

            binding.btnLogin.setOnClickListener {
                handleLogin()
            }

            binding.btnLogout.setOnClickListener {
                handleLogout()
            }

            binding.btnSyncNow.setOnClickListener {
                triggerManualSync()
            }

            binding.switchAutoSync.setOnCheckedChangeListener { _, isChecked ->
                prefs.edit().putBoolean("auto_sync", isChecked).apply()
                binding.tvLogOutput.text = if (isChecked) "Auto-Sync is ON. Calls will sync automatically upon hangup." else "Auto-Sync is OFF."
            }

            checkAndRequestPermissions()
        } catch (e: Exception) {
            Log.e("MainActivity", "Error in onCreate", e)
            Toast.makeText(this, "Startup error: ${e.message}", Toast.LENGTH_LONG).show()
        }
    }

    private fun checkAndRequestPermissions() {
        val permissions = mutableListOf(
            Manifest.permission.READ_CALL_LOG,
            Manifest.permission.READ_PHONE_STATE
        )

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            permissions.add(Manifest.permission.POST_NOTIFICATIONS)
        }

        val missing = permissions.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }

        if (missing.isNotEmpty()) {
            permissionLauncher.launch(missing.toTypedArray())
        } else {
            registerCallLogObserver()
            schedulePeriodicSync()
        }
    }

    private fun registerCallLogObserver() {
        if (callLogObserver != null) return
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_CALL_LOG) != PackageManager.PERMISSION_GRANTED) return

        try {
            val handler = Handler(Looper.getMainLooper())
            callLogObserver = object : ContentObserver(handler) {
                override fun onChange(selfChange: Boolean) {
                    super.onChange(selfChange)
                    Log.d("MainActivity", "CallLog ContentObserver triggered. Syncing...")
                    lifecycleScope.launch {
                        delay(1500) // Brief delay to ensure duration is finalized by carrier OS
                        CallSyncWorker.performDirectSync(this@MainActivity, isManual = false)
                        val prefs = getSharedPreferences("crm_sync_prefs", Context.MODE_PRIVATE)
                        val status = prefs.getString("last_sync_status", null)
                        if (!status.isNullOrEmpty()) {
                            binding.tvLogOutput.text = status
                        }
                    }
                }
            }

            contentResolver.registerContentObserver(
                CallLog.Calls.CONTENT_URI,
                true,
                callLogObserver!!
            )
            Log.d("MainActivity", "CallLog ContentObserver registered successfully.")
        } catch (e: Exception) {
            Log.w("MainActivity", "Could not register ContentObserver: ${e.message}")
        }
    }

    private fun handleLogin() {
        val serverUrl = binding.etServerUrl.text.toString().trim()
        val email = binding.etEmail.text.toString().trim()
        val password = binding.etPassword.text.toString().trim()

        if (serverUrl.isEmpty() || email.isEmpty() || password.isEmpty()) {
            Toast.makeText(this, "Please enter server URL, email and password", Toast.LENGTH_SHORT).show()
            return
        }

        val prefs = getSharedPreferences("crm_sync_prefs", Context.MODE_PRIVATE)
        prefs.edit().putString("server_url", serverUrl).apply()

        binding.btnLogin.isEnabled = false
        binding.btnLogin.text = "Connecting..."

        lifecycleScope.launch {
            try {
                val api = ApiClient.getClient(this@MainActivity)
                val response = withContext(Dispatchers.IO) {
                    api.login(LoginRequest(email, password))
                }

                if (response.isSuccessful && response.body()?.success == true) {
                    val body = response.body()!!
                    val data = body.data

                    if (data != null) {
                        val token = data.token
                        val user = data.user
                        val orgId = data.organizations.firstOrNull()?.id ?: ""
                        val fullName = "${user.firstName} ${user.lastName}".trim()

                        prefs.edit()
                            .putString("auth_token", token)
                            .putString("user_id", user.id)
                            .putString("user_name", fullName)
                            .putString("org_id", orgId)
                            .apply()

                        showLoggedInState(fullName)
                        registerCallLogObserver()
                        triggerManualSync()
                        Toast.makeText(this@MainActivity, "Connected to Artho Vista CRM!", Toast.LENGTH_SHORT).show()
                    }
                } else {
                    val error = response.errorBody()?.string() ?: "Invalid credentials"
                    Toast.makeText(this@MainActivity, "Login failed: $error", Toast.LENGTH_LONG).show()
                }
            } catch (e: Exception) {
                Toast.makeText(this@MainActivity, "Connection error: ${e.localizedMessage}", Toast.LENGTH_LONG).show()
            } finally {
                binding.btnLogin.isEnabled = true
                binding.btnLogin.text = "Login & Connect"
            }
        }
    }

    private fun handleLogout() {
        val prefs = getSharedPreferences("crm_sync_prefs", Context.MODE_PRIVATE)
        prefs.edit().remove("auth_token").remove("org_id").remove("user_name").apply()
        showLoggedOutState()
        Toast.makeText(this, "Disconnected.", Toast.LENGTH_SHORT).show()
    }

    private fun showLoggedInState(userName: String) {
        binding.tvStatusHeader.text = "● Connected to CRM (Live Sync Active)"
        binding.tvStatusHeader.setTextColor(0xFF10B981.toInt())
        binding.tvUserDetail.text = "Logged in as: $userName"
        binding.cardLogin.visibility = View.GONE
        binding.btnSyncNow.visibility = View.VISIBLE
        binding.btnLogout.visibility = View.VISIBLE
    }

    private fun showLoggedOutState() {
        binding.tvStatusHeader.text = "○ Disconnected"
        binding.tvStatusHeader.setTextColor(0xFFEF4444.toInt())
        binding.tvUserDetail.text = "Please log in with your employee credentials below."
        binding.cardLogin.visibility = View.VISIBLE
        binding.btnSyncNow.visibility = View.GONE
        binding.btnLogout.visibility = View.GONE
    }

    private fun triggerManualSync() {
        binding.tvLogOutput.text = "Checking SIM call logs..."
        lifecycleScope.launch {
            val success = CallSyncWorker.performDirectSync(this@MainActivity, isManual = true)
            val prefs = getSharedPreferences("crm_sync_prefs", Context.MODE_PRIVATE)
            val status = prefs.getString("last_sync_status", null)
            binding.tvLogOutput.text = status ?: if (success) "✓ Synced successfully" else "Sync completed"
        }
    }

    override fun onResume() {
        super.onResume()
        val prefs = getSharedPreferences("crm_sync_prefs", Context.MODE_PRIVATE)
        val status = prefs.getString("last_sync_status", null)
        if (!status.isNullOrEmpty()) {
            binding.tvLogOutput.text = status
        }
        registerCallLogObserver()
    }

    override fun onDestroy() {
        super.onDestroy()
        try {
            callLogObserver?.let {
                contentResolver.unregisterContentObserver(it)
                callLogObserver = null
            }
        } catch (e: Exception) {
            Log.e("MainActivity", "Error unregistering ContentObserver", e)
        }
    }

    private fun schedulePeriodicSync() {
        val periodicRequest = PeriodicWorkRequestBuilder<CallSyncWorker>(15, TimeUnit.MINUTES).build()
        WorkManager.getInstance(this).enqueueUniquePeriodicWork(
            "PeriodicCallSync",
            ExistingPeriodicWorkPolicy.KEEP,
            periodicRequest
        )
    }
}
