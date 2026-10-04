package com.example.pallas.data.coach

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.request.AggregateGroupByPeriodRequest
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.time.TimeRangeFilter
import java.time.Instant
import java.time.LocalDate
import java.time.Period
import java.time.ZoneId

class HealthConnectManager(private val context: Context) {

    val isAvailable: Boolean
        get() = HealthConnectClient.getSdkStatus(context) == HealthConnectClient.SDK_AVAILABLE

    val healthConnectClient: HealthConnectClient? by lazy {
        if (isAvailable) HealthConnectClient.getOrCreate(context) else null
    }

    val permissions = setOf(
        HealthPermission.getReadPermission(StepsRecord::class),
        HealthPermission.PERMISSION_READ_HEALTH_DATA_HISTORY
    )

    suspend fun hasPermissions(): Boolean {
        val client = healthConnectClient ?: return false
        return try {
            val granted = client.permissionController.getGrantedPermissions()
            // Check at minimum steps read permission
            granted.contains(HealthPermission.getReadPermission(StepsRecord::class))
        } catch (e: Exception) {
            false
        }
    }

    suspend fun getTodaySteps(): Long? {
        val client = healthConnectClient ?: return null
        if (!hasPermissions()) return null

        return try {
            val now = Instant.now()
            val zone = ZoneId.systemDefault()
            val startOfDay = LocalDate.now(zone).atStartOfDay(zone).toInstant()

            val response = client.aggregate(
                AggregateRequest(
                    metrics = setOf(StepsRecord.COUNT_TOTAL),
                    timeRangeFilter = TimeRangeFilter.between(startOfDay, now)
                )
            )
            response[StepsRecord.COUNT_TOTAL] ?: 0L
        } catch (e: Exception) {
            null
        }
    }

    suspend fun getStepsForDay(date: LocalDate): Long? {
        val client = healthConnectClient ?: return null
        if (!hasPermissions()) return null

        return try {
            val zone = ZoneId.systemDefault()
            val start = date.atStartOfDay(zone).toInstant()
            val end = date.plusDays(1).atStartOfDay(zone).toInstant()

            val response = client.aggregate(
                AggregateRequest(
                    metrics = setOf(StepsRecord.COUNT_TOTAL),
                    timeRangeFilter = TimeRangeFilter.between(start, end)
                )
            )
            response[StepsRecord.COUNT_TOTAL]
        } catch (e: Exception) {
            null
        }
    }

    suspend fun getDailyStepsForRange(startDate: LocalDate, endDate: LocalDate): Map<LocalDate, Long> {
        val client = healthConnectClient ?: return emptyMap()
        if (!hasPermissions()) return emptyMap()

        return try {
            val start = startDate.atStartOfDay()
            val end = endDate.plusDays(1).atStartOfDay()

            val response = client.aggregateGroupByPeriod(
                AggregateGroupByPeriodRequest(
                    metrics = setOf(StepsRecord.COUNT_TOTAL),
                    timeRangeFilter = TimeRangeFilter.between(start, end),
                    timeRangeSlicer = Period.ofDays(1)
                )
            )
            val map = mutableMapOf<LocalDate, Long>()
            for (bucket in response) {
                val count = bucket.result[StepsRecord.COUNT_TOTAL]
                if (count != null) {
                    map[bucket.startTime.toLocalDate()] = count
                }
            }
            map
        } catch (e: Exception) {
            // Log to console so we can debug fallback reasons
            e.printStackTrace()
            // Fallback to sequential read on failure or restricted devices
            val map = mutableMapOf<LocalDate, Long>()
            var curr = startDate
            while (!curr.isAfter(endDate)) {
                val count = getStepsForDay(curr)
                if (count != null) {
                    map[curr] = count
                }
                curr = curr.plusDays(1)
            }
            map
        }
    }
}
