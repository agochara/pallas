package com.example.pallas.ui.home

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shadow
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.pallas.R
import com.example.pallas.ui.theme.EBGaramond

@Composable
fun HomeScreen(
    onNavigateToStudy: () -> Unit,
    onNavigateToVadeMecum: () -> Unit,
    onNavigateToAskesis: () -> Unit,
    onNavigateToSettings: () -> Unit
) {
    val scrollState = rememberScrollState()

    Scaffold(
        containerColor = MaterialTheme.colorScheme.surface
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .verticalScroll(scrollState)
                .padding(horizontal = 20.dp, vertical = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Header
            Spacer(modifier = Modifier.height(16.dp))
            Text(
                text = "PALLAS",
                fontFamily = EBGaramond,
                fontWeight = FontWeight.Bold,
                fontSize = 36.sp,
                letterSpacing = 4.sp,
                color = MaterialTheme.colorScheme.onSurface,
                textAlign = TextAlign.Center
            )
            Text(
                text = "UNA SALUS VICTIS · NULLAM SPERARE SALUTEM",
                fontFamily = EBGaramond,
                fontStyle = FontStyle.Italic,
                fontSize = 12.sp,
                letterSpacing = 1.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(top = 6.dp, bottom = 28.dp)
            )

            // Featured Focal Container: The Study
            LauncherCard(
                title = "The Study",
                imageRes = R.drawable.cover_study,
                height = 190.dp,
                shape = MaterialTheme.shapes.extraLarge,
                onClick = onNavigateToStudy
            )

            Spacer(modifier = Modifier.height(14.dp))

            // 2-Column Secondary Grid
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                Box(modifier = Modifier.weight(1f)) {
                    LauncherCard(
                        title = "Vade Mecum",
                        imageRes = R.drawable.cover_vademecum,
                        height = 210.dp,
                        shape = MaterialTheme.shapes.large,
                        onClick = onNavigateToVadeMecum
                    )
                }

                Box(modifier = Modifier.weight(1f)) {
                    LauncherCard(
                        title = "Askesis",
                        imageRes = R.drawable.cover_askesis,
                        height = 210.dp,
                        shape = MaterialTheme.shapes.large,
                        onClick = onNavigateToAskesis
                    )
                }
            }

            Spacer(modifier = Modifier.height(28.dp))

            // Subordinate Settings Pill Button
            Surface(
                onClick = onNavigateToSettings,
                shape = CircleShape,
                color = MaterialTheme.colorScheme.surfaceContainerHigh,
                tonalElevation = 2.dp,
                modifier = Modifier.wrapContentSize()
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 22.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Icon(
                        imageVector = Icons.Outlined.Settings,
                        contentDescription = "Settings",
                        tint = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.size(18.dp)
                    )
                    Text(
                        text = "Settings",
                        style = MaterialTheme.typography.labelLarge,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            Spacer(modifier = Modifier.height(32.dp))
        }
    }
}

@Composable
fun LauncherCard(
    title: String,
    imageRes: Int,
    height: Dp,
    shape: androidx.compose.ui.graphics.Shape,
    onClick: () -> Unit
) {
    Card(
        onClick = onClick,
        shape = shape,
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceContainerHigh
        ),
        modifier = Modifier
            .fillMaxWidth()
            .height(height)
    ) {
        Box(modifier = Modifier.fillMaxSize()) {
            Image(
                painter = painterResource(id = imageRes),
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize()
            )

            // Contrast Scrim Overlay
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color.Black.copy(alpha = 0.25f))
            )

            // Title with Garamond and Drop Shadow
            Text(
                text = title,
                style = TextStyle(
                    fontFamily = EBGaramond,
                    fontWeight = FontWeight.Medium,
                    fontSize = 28.sp,
                    color = Color.White,
                    shadow = Shadow(
                        color = Color.Black.copy(alpha = 0.85f),
                        offset = Offset(0f, 4f),
                        blurRadius = 8f
                    )
                ),
                modifier = Modifier
                    .align(Alignment.BottomStart)
                    .padding(20.dp)
            )
        }
    }
}
