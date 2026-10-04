package com.example.pallas.data.coach

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.example.pallas.MainActivity
import com.example.pallas.R
import com.example.pallas.data.db.PallasDatabase
import com.example.pallas.util.DateFormats
import java.time.Duration
import java.time.LocalDate
import java.time.LocalDateTime
import java.util.concurrent.TimeUnit

class CoachNotificationWorker(
    appContext: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(appContext, workerParams) {

    override suspend fun doWork(): Result {
        val prefs = applicationContext.getSharedPreferences("pallas_sync", Context.MODE_PRIVATE)
        val notificationsEnabled = prefs.getBoolean("coach_notifications_enabled", false)
        if (!notificationsEnabled) {
            CoachNotificationScheduler.cancel(applicationContext)
            return Result.success()
        }

        val today = LocalDate.now()
        val todayStr = today.format(DateFormats.ISO_LOCAL_DATE)
        val lastNotifDate = prefs.getString("last_notification_date", null)
        if (lastNotifDate == todayStr) {
            // Never notify twice on the same day
            return Result.success()
        }

        val db = PallasDatabase.getInstance(applicationContext)
        val hc = HealthConnectManager(applicationContext)

        // Try reading today's steps if background access is permitted
        if (hc.isAvailable && hc.hasPermissions()) {
            try {
                val todaySteps = hc.getTodaySteps()
                if (todaySteps != null) {
                    db.updateCoachSteps(todayStr, todaySteps.toInt())
                }
            } catch (_: Exception) {
                // Background read may be restricted by Android unless special background permission granted
            }
        }

        val eval = CoachManager.evaluateRulesFromDb(db)
        if (eval.hasIssues) {
            sendNotification(eval)
            prefs.edit().putString("last_notification_date", todayStr).apply()
        }

        return Result.success()
    }

    private fun sendNotification(eval: CoachEvaluation) {
        val context = applicationContext
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        val channelId = "pallas_coach"
        val channel = NotificationChannel(
            channelId,
            "Coach Reminders",
            NotificationManager.IMPORTANCE_DEFAULT
        ).apply {
            description = "Daily reminders for steps and fasting"
        }
        nm.createNotificationChannel(channel)

        val message = when {
            eval.insufficientSteps && eval.missedFast ->
                "Time to move & fast: Step count is lagging and fasting window has arrived."
            eval.insufficientSteps ->
                "Time to move: Step count is lagging behind your goal."
            eval.missedFast ->
                "Time to fast: Scheduled fasting window has arrived."
            else -> return
        }

        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra("navigate_to", "askesis")
        }
        val pendingIntent = PendingIntent.getActivity(
            context,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(context, channelId)
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setContentTitle("Pallas Coach")
            .setContentText(message)
            .setStyle(NotificationCompat.BigTextStyle().bigText(message))
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .build()

        nm.notify(1001, notification)
    }
}

object CoachNotificationScheduler {
    const val WORK_NAME = "DAILY_COACH_NOTIFICATION"

    fun calculateInitialDelay(targetHour: Int = 15, targetMinute: Int = 0): Long {
        val now = LocalDateTime.now()
        var target = now.withHour(targetHour).withMinute(targetMinute).withSecond(0).withNano(0)
        if (now.isAfter(target)) {
            target = target.plusDays(1)
        }
        return Duration.between(now, target).toMillis().coerceAtLeast(0)
    }

    fun schedule(context: Context) {
        val prefs = context.getSharedPreferences("pallas_sync", Context.MODE_PRIVATE)
        val hour = prefs.getInt("coach_notification_hour", 15)
        val minute = prefs.getInt("coach_notification_minute", 0)
        val delayMs = calculateInitialDelay(hour, minute)
        val request = PeriodicWorkRequestBuilder<CoachNotificationWorker>(24, TimeUnit.HOURS)
            .setInitialDelay(delayMs, TimeUnit.MILLISECONDS)
            .build()

        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            WORK_NAME,
            ExistingPeriodicWorkPolicy.UPDATE,
            request
        )
    }

    fun cancel(context: Context) {
        WorkManager.getInstance(context).cancelUniqueWork(WORK_NAME)
    }
}
