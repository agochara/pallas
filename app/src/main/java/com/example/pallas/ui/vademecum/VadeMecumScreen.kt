package com.example.pallas.ui.vademecum

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowLeft
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.pallas.data.db.PallasDatabase
import com.example.pallas.ui.theme.EBGaramond
import com.example.pallas.ui.theme.VadePalette
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

data class MatchRange(val start: Int, val end: Int)

@Composable
fun VadeMecumScreen(
    onBack: () -> Unit
) {
    val context = LocalContext.current
    val db = remember { PallasDatabase.getInstance(context) }
    val scope = rememberCoroutineScope()

    val isDark = isSystemInDarkTheme()
    val palette = if (isDark) VadePalette.Dark else VadePalette.Light

    var content by remember { mutableStateOf("") }
    var loaded by remember { mutableStateOf(false) }

    var isSearching by remember { mutableStateOf(false) }
    var searchQuery by remember { mutableStateOf("") }
    var activeMatchIndex by remember { mutableStateOf(0) }

    var saveJob by remember { mutableStateOf<Job?>(null) }
    val scrollState = rememberScrollState()
    val searchFocusRequester = remember { FocusRequester() }

    LaunchedEffect(Unit) {
        content = db.getVadeMecum()
        loaded = true
    }

    fun onContentChanged(newText: String) {
        content = newText
        saveJob?.cancel()
        saveJob = scope.launch {
            delay(400)
            db.saveVadeMecum(newText)
        }
    }

    // Match calculation
    val matches = remember(content, searchQuery) {
        if (searchQuery.isBlank()) {
            emptyList()
        } else {
            val list = mutableListOf<MatchRange>()
            val lowerText = content.lowercase()
            val lowerQuery = searchQuery.lowercase()
            var idx = lowerText.indexOf(lowerQuery)
            while (idx != -1) {
                list.add(MatchRange(idx, idx + lowerQuery.length))
                idx = lowerText.indexOf(lowerQuery, idx + lowerQuery.length)
            }
            list
        }
    }

    LaunchedEffect(searchQuery) {
        activeMatchIndex = 0
    }

    LaunchedEffect(matches.size) {
        if (activeMatchIndex >= matches.size) {
            activeMatchIndex = if (matches.isNotEmpty()) matches.size - 1 else 0
        }
    }

    // Auto-scroll when active match changes
    LaunchedEffect(activeMatchIndex, matches) {
        if (isSearching && matches.isNotEmpty() && activeMatchIndex < matches.size) {
            val match = matches[activeMatchIndex]
            val totalLen = content.length.coerceAtLeast(1)
            val scrollFraction = match.start.toFloat() / totalLen
            val targetScroll = (scrollState.maxValue * scrollFraction).toInt()
            scrollState.animateScrollTo(targetScroll)
        }
    }

    fun handleBack() {
        saveJob?.cancel()
        scope.launch {
            db.saveVadeMecum(content)
            onBack()
        }
    }

    Scaffold(
        containerColor = palette.background,
        contentWindowInsets = WindowInsets(0, 0, 0, 0)
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .imePadding()
                .background(palette.background)
        ) {
            // Top Header
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .statusBarsPadding()
                    .padding(horizontal = 20.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = "‹ Pallas",
                    fontFamily = EBGaramond,
                    fontWeight = FontWeight.Medium,
                    fontSize = 17.sp,
                    color = palette.textSecondary,
                    modifier = Modifier
                        .clickable(onClick = { handleBack() })
                        .padding(vertical = 4.dp, horizontal = 4.dp)
                )

                Text(
                    text = "VADE MECUM",
                    fontFamily = EBGaramond,
                    fontWeight = FontWeight.Bold,
                    fontSize = 15.sp,
                    letterSpacing = 4.sp,
                    color = palette.text
                )

                IconButton(
                    onClick = {
                        isSearching = !isSearching
                        if (isSearching) {
                            searchQuery = ""
                            activeMatchIndex = 0
                        }
                    },
                    modifier = Modifier.size(36.dp)
                ) {
                    Icon(
                        imageVector = Icons.Outlined.Search,
                        contentDescription = "Search",
                        tint = palette.textSecondary
                    )
                }
            }

            HorizontalDivider(color = palette.separator, thickness = 0.5.dp)

            // Search Bar
            if (isSearching) {
                LaunchedEffect(Unit) {
                    searchFocusRequester.requestFocus()
                }

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 20.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    BasicTextField(
                        value = searchQuery,
                        onValueChange = { searchQuery = it },
                        textStyle = TextStyle(
                            fontFamily = EBGaramond,
                            fontSize = 18.sp,
                            color = palette.text
                        ),
                        cursorBrush = SolidColor(palette.accent),
                        singleLine = true,
                        modifier = Modifier
                            .weight(1f)
                            .focusRequester(searchFocusRequester),
                        decorationBox = { innerTextField ->
                            if (searchQuery.isEmpty()) {
                                Text(
                                    text = "Search the manuscript...",
                                    fontFamily = EBGaramond,
                                    fontSize = 18.sp,
                                    color = palette.textSecondary.copy(alpha = 0.6f)
                                )
                            }
                            innerTextField()
                        }
                    )

                    if (searchQuery.isNotEmpty()) {
                        Text(
                            text = if (matches.isNotEmpty()) "${activeMatchIndex + 1}/${matches.size}" else "none",
                            fontFamily = EBGaramond,
                            fontWeight = FontWeight.Medium,
                            fontSize = 15.sp,
                            color = palette.textSecondary,
                            modifier = Modifier.padding(horizontal = 6.dp)
                        )

                        // Prev button
                        IconButton(
                            onClick = {
                                activeMatchIndex = (activeMatchIndex - 1 + matches.size) % matches.size
                            },
                            enabled = matches.isNotEmpty(),
                            modifier = Modifier.size(32.dp)
                        ) {
                            Icon(
                                imageVector = Icons.AutoMirrored.Filled.KeyboardArrowLeft,
                                contentDescription = "Previous match",
                                tint = if (matches.isNotEmpty()) palette.text else palette.textSecondary.copy(alpha = 0.4f),
                                modifier = Modifier.size(20.dp)
                            )
                        }

                        // Next button
                        IconButton(
                            onClick = {
                                activeMatchIndex = (activeMatchIndex + 1) % matches.size
                            },
                            enabled = matches.isNotEmpty(),
                            modifier = Modifier.size(32.dp)
                        ) {
                            Icon(
                                imageVector = Icons.AutoMirrored.Filled.KeyboardArrowRight,
                                contentDescription = "Next match",
                                tint = if (matches.isNotEmpty()) palette.text else palette.textSecondary.copy(alpha = 0.4f),
                                modifier = Modifier.size(20.dp)
                            )
                        }
                    }

                    IconButton(
                        onClick = {
                            isSearching = false
                            searchQuery = ""
                        },
                        modifier = Modifier.size(28.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Outlined.Close,
                            contentDescription = "Close Search",
                            tint = palette.textSecondary,
                            modifier = Modifier.size(18.dp)
                        )
                    }
                }

                HorizontalDivider(color = palette.separator, thickness = 0.5.dp)
            }

        // Manuscript Content
        Box(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(scrollState)
                .padding(horizontal = 28.dp, vertical = 24.dp)
                .navigationBarsPadding()
        ) {
            if (isSearching && searchQuery.isNotEmpty() && matches.isNotEmpty()) {
                // Highlighted Search Mode
                val annotatedString = remember(content, matches, activeMatchIndex, palette) {
                    buildAnnotatedString {
                        var cursor = 0
                        matches.forEachIndexed { idx, match ->
                            if (match.start > cursor) {
                                append(content.substring(cursor, match.start))
                            }
                            val bg = if (idx == activeMatchIndex) palette.highlightActive else palette.highlight
                            val spanStyle = SpanStyle(background = bg)
                            val matchText = content.substring(match.start, match.end)
                            pushStyle(spanStyle)
                            append(matchText)
                            pop()
                            cursor = match.end
                        }
                        if (cursor < content.length) {
                            append(content.substring(cursor))
                        }
                    }
                }

                Text(
                    text = annotatedString,
                    style = TextStyle(
                        fontFamily = EBGaramond,
                        fontSize = 19.5.sp,
                        lineHeight = 33.sp,
                        color = palette.text
                    ),
                    modifier = Modifier.fillMaxWidth()
                )
            } else {
                // Editing Manuscript Mode
                BasicTextField(
                    value = content,
                    onValueChange = { onContentChanged(it) },
                    textStyle = TextStyle(
                        fontFamily = EBGaramond,
                        fontSize = 19.5.sp,
                        lineHeight = 33.sp,
                        color = palette.text
                    ),
                    cursorBrush = SolidColor(palette.accent),
                    modifier = Modifier
                        .fillMaxWidth()
                        .defaultMinSize(minHeight = 400.dp),
                    decorationBox = { innerTextField ->
                        if (content.isEmpty() && loaded) {
                            Text(
                                text = "Type anything...",
                                fontFamily = EBGaramond,
                                fontSize = 19.5.sp,
                                color = palette.textSecondary.copy(alpha = 0.5f)
                            )
                        }
                        innerTextField()
                    }
                )
            }
        }
    }
}
}

