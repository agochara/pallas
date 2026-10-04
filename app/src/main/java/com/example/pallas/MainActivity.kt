package com.example.pallas

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.example.pallas.data.coach.CoachManager
import com.example.pallas.data.db.PallasDatabase
import com.example.pallas.ui.askesis.AskesisCache
import com.example.pallas.ui.askesis.AskesisScreen
import com.example.pallas.ui.home.HomeScreen
import com.example.pallas.ui.settings.SettingsScreen
import com.example.pallas.ui.study.StudyScreen
import com.example.pallas.ui.theme.PallasTheme
import com.example.pallas.ui.vademecum.VadeMecumScreen
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

private val EmphasizedDecelerate = CubicBezierEasing(0.05f, 0.7f, 0.1f, 1f)
private val EmphasizedAccelerate = CubicBezierEasing(0.3f, 0f, 0.8f, 0.15f)
private val StandardDecelerate = FastOutSlowInEasing
private const val NAV_ENTER_MS = 320
private const val NAV_POP_MS = 240

@OptIn(kotlinx.coroutines.DelicateCoroutinesApi::class)
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        // Pre-warm Askesis state cache and database off the main thread
        lifecycleScope.launch(Dispatchers.IO) {
            AskesisCache.warm(PallasDatabase.getInstance(this@MainActivity))
        }

        // Cancel legacy hourly sync worker if previously scheduled
        androidx.work.WorkManager.getInstance(this).cancelUniqueWork("COACH_BACKGROUND_SYNC")

        // Schedule daily reminder if enabled by user in Settings
        val prefs = getSharedPreferences("pallas_sync", android.content.Context.MODE_PRIVATE)
        if (prefs.getBoolean("coach_notifications_enabled", false)) {
            com.example.pallas.data.coach.CoachNotificationScheduler.schedule(this)
        }
        
        // Incremental steps sync whenever the app enters foreground (debounced to ~10 minutes)
        lifecycleScope.launch {
            lifecycle.repeatOnLifecycle(androidx.lifecycle.Lifecycle.State.STARTED) {
                CoachManager.syncStepsIncremental(this@MainActivity)
            }
        }

        setContent {
            PallasTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    val navController = rememberNavController()
                    NavHost(
                        navController = navController,
                        startDestination = "home",
                        enterTransition = {
                            slideInHorizontally(
                                animationSpec = tween(NAV_ENTER_MS, easing = EmphasizedDecelerate),
                                initialOffsetX = { fullWidth -> fullWidth }
                            )
                        },
                        exitTransition = {
                            slideOutHorizontally(
                                animationSpec = tween(NAV_ENTER_MS, easing = EmphasizedAccelerate),
                                targetOffsetX = { fullWidth -> -fullWidth / 4 }
                            )
                        },
                        popEnterTransition = {
                            slideInHorizontally(
                                animationSpec = tween(NAV_POP_MS, easing = StandardDecelerate),
                                initialOffsetX = { fullWidth -> -fullWidth / 4 }
                            )
                        },
                        popExitTransition = {
                            slideOutHorizontally(
                                animationSpec = tween(NAV_POP_MS, easing = StandardDecelerate),
                                targetOffsetX = { fullWidth -> fullWidth }
                            )
                        }
                    ) {
                        composable("home") {
                            HomeScreen(
                            onNavigateToStudy = { navController.navigate("study") },
                            onNavigateToVadeMecum = { navController.navigate("vademecum") },
                            onNavigateToAskesis = { navController.navigate("askesis") },
                            onNavigateToSettings = { navController.navigate("settings") }
                        )
                    }

                    composable("study") {
                        StudyScreen(
                            onBack = { navController.popBackStack() }
                        )
                    }

                    composable("vademecum") {
                        VadeMecumScreen(
                            onBack = { navController.popBackStack() }
                        )
                    }

                    composable("askesis") {
                        AskesisScreen(
                            onBack = { navController.popBackStack() }
                        )
                    }

                    composable("settings") {
                        SettingsScreen(
                            onBack = { navController.popBackStack() }
                        )
                    }
                }
            }
        }
    }
}
}