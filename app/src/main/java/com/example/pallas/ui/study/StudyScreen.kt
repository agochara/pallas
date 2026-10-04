package com.example.pallas.ui.study

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.pallas.data.content.ContentData
import com.example.pallas.data.db.NewsletterState
import com.example.pallas.data.db.PallasDatabase
import com.example.pallas.ui.theme.EBGaramond
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*
import kotlin.random.Random

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun StudyScreen(
    onBack: () -> Unit
) {
    val context = LocalContext.current
    val db = remember { PallasDatabase.getInstance(context) }
    val scope = rememberCoroutineScope()

    var state by remember { mutableStateOf<NewsletterState?>(null) }
    var showSettingsSheet by remember { mutableStateOf(false) }

    fun getRandomQuotes(): Pair<String, String> {
        val quotes = ContentData.myQuotes
        if (quotes.isEmpty()) return Pair("", "")
        if (quotes.size == 1) return Pair(quotes[0], quotes[0])
        val idx1 = Random.nextInt(quotes.size)
        var idx2 = Random.nextInt(quotes.size - 1)
        if (idx2 >= idx1) idx2++
        return Pair(quotes[idx1], quotes[idx2])
    }

    fun loadData() {
        scope.launch {
            val s = db.getNewsletterState()
            val todayStr = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())

            if (s.lastIssueDate == null) {
                val (q1, q2) = getRandomQuotes()
                db.saveDailyNewsletterEdition(s.issueNumber, todayStr, q1, q2)
                state = db.getNewsletterState()
            } else if (s.lastIssueDate != todayStr) {
                val nextIssue = s.issueNumber + 1
                val (q1, q2) = getRandomQuotes()
                db.saveDailyNewsletterEdition(nextIssue, todayStr, q1, q2)
                state = db.getNewsletterState()
            } else {
                state = s
            }
        }
    }

    LaunchedEffect(Unit) {
        loadData()
    }

    val issueNum = state?.issueNumber ?: 33
    val poemIndex = (issueNum - 1).coerceAtLeast(0) % ContentData.taoTeChing.size
    val dailyPoem = ContentData.taoTeChing.getOrElse(poemIndex) { "" }

    val formattedDate = remember {
        val sdf = SimpleDateFormat("EEEE, MMMM d, yyyy", Locale.US)
        sdf.format(Date())
    }

    val scrollState = rememberScrollState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = "THE STUDY",
                        fontFamily = EBGaramond,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 2.sp
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Back"
                        )
                    }
                },
                actions = {
                    IconButton(onClick = { showSettingsSheet = true }) {
                        Icon(
                            imageVector = Icons.Outlined.Settings,
                            contentDescription = "Settings",
                            tint = MaterialTheme.colorScheme.primary
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface
                )
            )
        },
        containerColor = MaterialTheme.colorScheme.surface
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .verticalScroll(scrollState)
                .padding(horizontal = 20.dp, vertical = 16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // Masthead Card
            Card(
                shape = MaterialTheme.shapes.extraLarge,
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.surfaceContainerHigh
                ),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 24.dp, horizontal = 16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = "The Study",
                        fontFamily = EBGaramond,
                        fontWeight = FontWeight.Bold,
                        fontSize = 32.sp,
                        letterSpacing = 3.sp,
                        color = MaterialTheme.colorScheme.onSurface
                    )

                    Spacer(modifier = Modifier.height(12.dp))
                    HorizontalDivider(
                        modifier = Modifier.width(180.dp),
                        color = MaterialTheme.colorScheme.outlineVariant
                    )
                    Spacer(modifier = Modifier.height(10.dp))

                    Text(
                        text = "ISSUE #$issueNum",
                        style = MaterialTheme.typography.labelLarge,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 2.sp,
                        color = MaterialTheme.colorScheme.primary
                    )

                    Text(
                        text = formattedDate,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(top = 2.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // To Self Section (if non-empty)
            val toSelf = state?.toSelfText?.trim() ?: ""
            if (toSelf.isNotEmpty()) {
                Card(
                    shape = MaterialTheme.shapes.large,
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.surfaceContainer
                    ),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(20.dp)) {
                        Text(
                            text = "TO SELF",
                            style = MaterialTheme.typography.labelLarge,
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 1.5.sp,
                            color = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.padding(bottom = 12.dp)
                        )
                        Text(
                            text = toSelf,
                            style = MaterialTheme.typography.bodyLarge,
                            lineHeight = 26.sp,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                    }
                }
                Spacer(modifier = Modifier.height(16.dp))
            }

            // From the Archives Section (if non-empty)
            val hasArchives = !state?.archiveQuote1.isNullOrBlank() || !state?.archiveQuote2.isNullOrBlank()
            if (hasArchives) {
                Card(
                    shape = MaterialTheme.shapes.large,
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.surfaceContainer
                    ),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Column(modifier = Modifier.padding(20.dp)) {
                        Text(
                            text = "FROM THE ARCHIVES",
                            style = MaterialTheme.typography.labelLarge,
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 1.5.sp,
                            color = MaterialTheme.colorScheme.primary,
                            modifier = Modifier.padding(bottom = 14.dp)
                        )

                        state?.archiveQuote1?.let { q1 ->
                            if (q1.isNotBlank()) {
                                Text(
                                    text = "“$q1”",
                                    style = MaterialTheme.typography.bodyLarge,
                                    lineHeight = 26.sp,
                                    color = MaterialTheme.colorScheme.onSurface,
                                    modifier = Modifier.padding(bottom = 14.dp)
                                )
                            }
                        }

                        state?.archiveQuote2?.let { q2 ->
                            if (q2.isNotBlank()) {
                                Text(
                                    text = "“$q2”",
                                    style = MaterialTheme.typography.bodyLarge,
                                    lineHeight = 26.sp,
                                    color = MaterialTheme.colorScheme.onSurface
                                )
                            }
                        }
                    }
                }
                Spacer(modifier = Modifier.height(16.dp))
            }

            // Tao Te Ching Section
            Card(
                shape = MaterialTheme.shapes.large,
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.surfaceContainer
                ),
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(modifier = Modifier.padding(20.dp)) {
                    Text(
                        text = "TAO TE CHING",
                        style = MaterialTheme.typography.labelLarge,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 1.5.sp,
                        color = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.padding(bottom = 12.dp)
                    )

                    TaoTeChingPoem(dailyPoem)
                }
            }

            Spacer(modifier = Modifier.height(24.dp))
            HorizontalDivider(
                modifier = Modifier.width(120.dp),
                color = MaterialTheme.colorScheme.outlineVariant
            )
            Spacer(modifier = Modifier.height(12.dp))
            Text(
                text = "— End of Edition —",
                style = MaterialTheme.typography.labelMedium,
                fontStyle = FontStyle.Italic,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Spacer(modifier = Modifier.height(36.dp))
        }
    }

    // Settings Bottom Sheet
    if (showSettingsSheet && state != null) {
        ModalBottomSheet(
            onDismissRequest = { showSettingsSheet = false }
        ) {
            StudySettingsContent(
                currentState = state!!,
                onSave = { newIssue, newToSelf ->
                    scope.launch {
                        db.saveNewsletterSettings(newIssue, newToSelf)
                        state = db.getNewsletterState()
                        showSettingsSheet = false
                    }
                },
                onAdvance = {
                    scope.launch {
                        val next = (state?.issueNumber ?: 33) + 1
                        val (q1, q2) = getRandomQuotes()
                        val today = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
                        db.saveDailyNewsletterEdition(next, today, q1, q2)
                        state = db.getNewsletterState()
                        showSettingsSheet = false
                    }
                },
                onShuffle = {
                    scope.launch {
                        val (q1, q2) = getRandomQuotes()
                        val today = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
                        db.saveDailyNewsletterEdition(state?.issueNumber ?: 33, today, q1, q2)
                        state = db.getNewsletterState()
                        showSettingsSheet = false
                    }
                }
            )
        }
    }
}

@Composable
fun TaoTeChingPoem(poemHtml: String) {
    if (poemHtml.isBlank()) return

    val titleRegex = Regex("<b>(.*?)</b>(?:<br>)?", RegexOption.IGNORE_CASE)
    val titleMatch = titleRegex.find(poemHtml)
    val title = titleMatch?.groupValues?.getOrNull(1)
    val body = if (titleMatch != null) poemHtml.replace(titleMatch.value, "") else poemHtml

    val lines = body.split(Regex("<br\\s*/?>", RegexOption.IGNORE_CASE))

    Column {
        if (!title.isNullOrBlank()) {
            Text(
                text = title,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onSurface,
                modifier = Modifier.padding(bottom = 12.dp)
            )
        }

        for (line in lines) {
            val trimmed = line.trim()
            if (trimmed.isEmpty()) {
                Spacer(modifier = Modifier.height(8.dp))
            } else {
                Text(
                    text = trimmed,
                    style = MaterialTheme.typography.bodyLarge,
                    lineHeight = 26.sp,
                    color = MaterialTheme.colorScheme.onSurface,
                    modifier = Modifier.padding(bottom = 4.dp)
                )
            }
        }
    }
}

@Composable
fun StudySettingsContent(
    currentState: NewsletterState,
    onSave: (Int, String) -> Unit,
    onAdvance: () -> Unit,
    onShuffle: () -> Unit
) {
    var issueText by remember { mutableStateOf(currentState.issueNumber.toString()) }
    var toSelfText by remember { mutableStateOf(currentState.toSelfText) }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .verticalScroll(rememberScrollState())
            .imePadding()
            .padding(horizontal = 24.dp, vertical = 16.dp)
    ) {
        Text(
            text = "The Study Settings",
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onSurface
        )

        Spacer(modifier = Modifier.height(18.dp))

        OutlinedTextField(
            value = issueText,
            onValueChange = { issueText = it },
            label = { Text("Issue Number") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(modifier = Modifier.height(14.dp))

        OutlinedTextField(
            value = toSelfText,
            onValueChange = { toSelfText = it },
            label = { Text("To Self (Personal Note)") },
            placeholder = { Text("Write your note to self...") },
            minLines = 3,
            maxLines = 6,
            modifier = Modifier.fillMaxWidth()
        )

        Spacer(modifier = Modifier.height(20.dp))

        Button(
            onClick = {
                val num = issueText.toIntOrNull() ?: currentState.issueNumber
                onSave(num, toSelfText)
            },
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("SAVE SETTINGS")
        }

        Spacer(modifier = Modifier.height(10.dp))

        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            FilledTonalButton(
                onClick = onAdvance,
                modifier = Modifier.weight(1f)
            ) {
                Text("Advance (+1)")
            }

            FilledTonalButton(
                onClick = onShuffle,
                modifier = Modifier.weight(1f)
            ) {
                Text("Shuffle Quotes")
            }
        }

        Spacer(modifier = Modifier.height(24.dp))
    }
}
