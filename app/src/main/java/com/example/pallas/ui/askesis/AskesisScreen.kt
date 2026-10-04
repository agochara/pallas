package com.example.pallas.ui.askesis

import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.FastOutLinearInEasing
import androidx.compose.animation.core.LinearOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.exclude
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.ime
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.outlined.DirectionsWalk
import androidx.compose.material.icons.outlined.FitnessCenter
import androidx.compose.material.icons.outlined.MonitorWeight
import androidx.compose.material.icons.outlined.Shield
import androidx.compose.material.icons.outlined.Timer
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import com.example.pallas.data.db.PallasDatabase
import com.example.pallas.ui.theme.EBGaramond

enum class AskesisTab(val label: String, val icon: ImageVector) {
    STEPS("Steps", Icons.AutoMirrored.Outlined.DirectionsWalk),
    FASTING("Fasting", Icons.Outlined.Timer),
    STRENGTH("Strength", Icons.Outlined.FitnessCenter),
    WEIGHT("Weight", Icons.Outlined.MonitorWeight),
    COACH("Coach", Icons.Outlined.Shield)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AskesisScreen(onBack: () -> Unit) {
    val context = LocalContext.current
    val db = remember { PallasDatabase.getInstance(context) }

    var currentTab by rememberSaveable { mutableStateOf(AskesisTab.STEPS) }
    var hasCoachEvents by remember { mutableStateOf(AskesisCache.hasCoachEvents) }

    LaunchedEffect(currentTab) {
        val eval = com.example.pallas.data.coach.CoachManager.evaluateAndPublishRules(context)
        hasCoachEvents = eval.hasIssues
    }

    BackHandler(enabled = currentTab != AskesisTab.STEPS) {
        currentTab = AskesisTab.STEPS
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = "ASKESIS",
                        fontFamily = EBGaramond,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 2.sp
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            )
        },
        bottomBar = {
            NavigationBar(containerColor = MaterialTheme.colorScheme.surfaceContainer) {
                AskesisTab.entries.forEach { tab ->
                    val selected = currentTab == tab
                    NavigationBarItem(
                        selected = selected,
                        onClick = { currentTab = tab },
                        icon = {
                            if (tab == AskesisTab.COACH && hasCoachEvents) {
                                BadgedBox(badge = { Badge() }) {
                                    Icon(tab.icon, contentDescription = tab.label)
                                }
                            } else {
                                Icon(tab.icon, contentDescription = tab.label)
                            }
                        },
                        label = {
                            Text(
                                text = tab.label,
                                style = if (selected) MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.SemiBold)
                                else MaterialTheme.typography.labelSmall
                            )
                        },
                        colors = NavigationBarItemDefaults.colors(
                            indicatorColor = MaterialTheme.colorScheme.secondaryContainer,
                            selectedIconColor = MaterialTheme.colorScheme.onSecondaryContainer,
                            selectedTextColor = MaterialTheme.colorScheme.onSurface,
                            unselectedIconColor = MaterialTheme.colorScheme.onSurfaceVariant,
                            unselectedTextColor = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    )
                }
            }
        },
        containerColor = MaterialTheme.colorScheme.surface
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                // Only the part of the keyboard that rises above the bottom bar.
                // Read in the layout phase, so there is no per-frame recomposition.
                .windowInsetsPadding(
                    WindowInsets.ime.exclude(WindowInsets(bottom = innerPadding.calculateBottomPadding()))
                )
        ) {
            AnimatedContent(
                targetState = currentTab,
                transitionSpec = {
                    (fadeIn(animationSpec = tween(210, delayMillis = 90, easing = LinearOutSlowInEasing)) +
                        scaleIn(animationSpec = tween(210, delayMillis = 90, easing = LinearOutSlowInEasing), initialScale = 0.96f))
                        .togetherWith(
                            fadeOut(animationSpec = tween(90, easing = FastOutLinearInEasing))
                        )
                },
                label = "AskesisTabFadeThrough"
            ) { tab ->
                when (tab) {
                    AskesisTab.STEPS -> StepsTab()
                    AskesisTab.FASTING -> FastingTab()
                    AskesisTab.STRENGTH -> StrengthTab()
                    AskesisTab.WEIGHT -> WeightTab()
                    AskesisTab.COACH -> CoachTab()
                }
            }
        }
    }
}
