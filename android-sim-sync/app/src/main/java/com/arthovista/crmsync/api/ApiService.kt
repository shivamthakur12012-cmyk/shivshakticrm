package com.arthovista.crmsync.api

import android.content.Context
import com.arthovista.crmsync.models.LoginRequest
import com.arthovista.crmsync.models.LoginResponse
import com.arthovista.crmsync.models.SyncRequest
import com.arthovista.crmsync.models.SyncResponse
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Response
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.Body
import retrofit2.http.Header
import retrofit2.http.POST
import java.util.concurrent.TimeUnit

interface ApiInterface {

    @POST("/api/auth/login")
    suspend fun login(
        @Body request: LoginRequest
    ): Response<LoginResponse>

    @POST("/api/mobile-sync/calls")
    suspend fun syncCallLogs(
        @Header("Authorization") token: String,
        @Header("x-organization-id") orgId: String,
        @Body request: SyncRequest
    ): Response<SyncResponse>
}

object ApiClient {
    private var retrofit: Retrofit? = null
    private var currentBaseUrl: String = ""

    fun getClient(context: Context): ApiInterface {
        val prefs = context.getSharedPreferences("crm_sync_prefs", Context.MODE_PRIVATE)
        var serverUrl = prefs.getString("server_url", "http://10.0.2.2:5000") ?: "http://10.0.2.2:5000"
        
        if (!serverUrl.endsWith("/")) {
            serverUrl += "/"
        }

        if (retrofit == null || currentBaseUrl != serverUrl) {
            currentBaseUrl = serverUrl

            val logging = HttpLoggingInterceptor().apply {
                level = HttpLoggingInterceptor.Level.BODY
            }

            val okHttpClient = OkHttpClient.Builder()
                .addInterceptor(logging)
                .connectTimeout(15, TimeUnit.SECONDS)
                .readTimeout(15, TimeUnit.SECONDS)
                .build()

            retrofit = Retrofit.Builder()
                .baseUrl(serverUrl)
                .client(okHttpClient)
                .addConverterFactory(GsonConverterFactory.create())
                .build()
        }

        return retrofit!!.create(ApiInterface::class.java)
    }
}
