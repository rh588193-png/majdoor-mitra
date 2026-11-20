package com.majdoor.mitra

import android.app.Application
import android.util.Log
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.FirebaseFirestoreSettings
import com.google.firebase.firestore.PersistentCacheSettings
import com.google.firebase.firestore.Source
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

class MajdoorMitraApp : Application() {

    private val appScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    lateinit var firestore: FirebaseFirestore
        private set

    override fun onCreate() {
        super.onCreate()
        initFirebase()
    }

    private fun initFirebase() {
        val existing = FirebaseApp.getApps(this)
        val app = if (existing.isNotEmpty()) {
            existing.first()
        } else {
            val options = FirebaseOptions.Builder()
                .setProjectId(BuildConfig.FIREBASE_PROJECT_ID)
                .setApplicationId(BuildConfig.FIREBASE_APP_ID)
                .setApiKey(BuildConfig.FIREBASE_API_KEY)
                .setStorageBucket(BuildConfig.FIREBASE_STORAGE_BUCKET)
                .setGcmSenderId(BuildConfig.FIREBASE_SENDER_ID)
                .build()
            FirebaseApp.initializeApp(this, options)
        }

        val db = FirebaseFirestore.getInstance(app, BuildConfig.FIRESTORE_DATABASE_ID)
        val settings = FirebaseFirestoreSettings.Builder()
            .setLocalCacheSettings(
                PersistentCacheSettings.newBuilder()
                    .setSizeBytes(50L * 1024L * 1024L)
                    .build()
            )
            .build()
        db.firestoreSettings = settings
        firestore = db

        testConnection(db)
    }

    private fun testConnection(db: FirebaseFirestore) {
        appScope.launch {
            try {
                db.collection("test").document("connection").get(Source.SERVER).await()
            } catch (e: Exception) {
                val msg = e.message.orEmpty()
                if (msg.contains("client is offline", ignoreCase = true) ||
                    msg.contains("UNAVAILABLE", ignoreCase = true)
                ) {
                    Log.w(TAG, "Firestore unreachable at startup; offline cache remains active.", e)
                } else {
                    Log.d(TAG, "Startup Firestore connection probe completed: ${e.message}")
                }
            }
        }
    }

    companion object {
        private const val TAG = "MajdoorMitraApp"
    }
}
