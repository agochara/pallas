package com.example.pallas

import com.example.pallas.data.coach.CoachManager
import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Test

class CoachManagerTest {

    @Test
    fun test1RmCalculation() = runBlocking {
        val res1 = CoachManager.executeCoachCommand(null, "/1rm 100x1")
        assertTrue(res1.text.contains("100.0 kg"))

        val res2 = CoachManager.executeCoachCommand(null, "/1rm 80x5")
        // 80 * (1 + 5/30) = 80 * (1.1666...) = 93.3 kg
        assertTrue(res2.text.contains("93.3 kg"))
    }

    @Test
    fun testBmiCalculation() = runBlocking {
        val res = CoachManager.executeCoachCommand(null, "/bmi 75 180")
        assertEquals("bmi", res.ui)
        assertNotNull(res.bmiPayload)
        assertEquals("Normal weight", res.bmiPayload?.category)
        assertTrue(res.text.contains("23.1"))
    }

    @Test
    fun testConvertCalculation() = runBlocking {
        val res1 = CoachManager.executeCoachCommand(null, "/convert 100 kg")
        assertTrue(res1.text.contains("lbs"))

        val res2 = CoachManager.executeCoachCommand(null, "/convert 150 lbs")
        assertTrue(res2.text.contains("kg"))
    }

    @Test
    fun testSearchCommand() = runBlocking {
        val res = CoachManager.executeCoachCommand(null, "/search procrastination")
        assertEquals("search", res.ui)
        assertNotNull(res.searchPayload)
        assertTrue(res.searchPayload!!.matches.isNotEmpty())
    }

    @Test
    fun testHelpCommand() = runBlocking {
        val res = CoachManager.executeCoachCommand(null, "/help")
        assertTrue(res.text.contains("Available Coach commands"))
    }
}
