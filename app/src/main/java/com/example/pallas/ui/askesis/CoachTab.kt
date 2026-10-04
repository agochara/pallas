package com.example.pallas.ui.askesis

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.pallas.data.coach.BmiPayload
import com.example.pallas.data.coach.CoachManager
import com.example.pallas.data.coach.CommandResult
import com.example.pallas.data.coach.SearchPayload
import com.example.pallas.data.db.CoachEvent
import com.example.pallas.data.db.PallasDatabase
import kotlinx.coroutines.launch
import java.util.UUID

data class ChatItem(
    val id: String,
    val isUser: Boolean,
    val text: String,
    val isEvent: Boolean = false,
    val result: CommandResult? = null
)

@Composable
fun CoachTab() {
    val context = LocalContext.current
    val db = remember { PallasDatabase.getInstance(context) }
    val scope = rememberCoroutineScope()

    var evaluation by remember { mutableStateOf(AskesisCache.coachEvaluation) }
    var ephemeralMessages by remember { mutableStateOf<List<ChatItem>>(emptyList()) }
    var inputText by remember { mutableStateOf("") }
    val listState = rememberLazyListState()

    fun loadStatus() {
        scope.launch {
            val eval = CoachManager.evaluateAndPublishRules(context)
            evaluation = eval
        }
    }
    fun loadEvents() = loadStatus()

    LaunchedEffect(Unit) {
        loadStatus()
    }

    val eventItems = remember(evaluation) {
        val list = mutableListOf<ChatItem>()
        if (evaluation.insufficientSteps) {
            list.add(
                ChatItem(
                    id = "eval_steps",
                    isUser = false,
                    text = "Gotta walk! Step count is lagging behind.",
                    isEvent = true
                )
            )
        }
        if (evaluation.missedFast) {
            list.add(
                ChatItem(
                    id = "eval_fast",
                    isUser = false,
                    text = "Gotta fast! Scheduled window has arrived.",
                    isEvent = true
                )
            )
        }
        list
    }

    val allMessages = remember(eventItems, ephemeralMessages) {
        eventItems + ephemeralMessages
    }

    val reversedMessages = remember(allMessages) { allMessages.asReversed() }

    LaunchedEffect(allMessages.size) {
        if (allMessages.isNotEmpty()) {
            listState.animateScrollToItem(0)
        }
    }

    fun handleSend(textToSend: String = inputText) {
        val trimmed = textToSend.trim()
        if (trimmed.isEmpty()) return

        val userItem = ChatItem(id = UUID.randomUUID().toString(), isUser = true, text = trimmed)
        ephemeralMessages = ephemeralMessages + userItem
        inputText = ""

        scope.launch {
            val reply = try {
                CoachManager.executeCoachCommand(context, trimmed)
            } catch (e: Exception) {
                e.printStackTrace()
                CommandResult("An error occurred while processing your command: ${e.message}")
            }
            val botItem = ChatItem(
                id = UUID.randomUUID().toString(),
                isUser = false,
                text = reply.text,
                result = reply
            )
            ephemeralMessages = ephemeralMessages + botItem
            loadEvents()
        }
    }

    Column(
        modifier = Modifier.fillMaxSize()
    ) {
        // Coach Header
        Text(
            text = "Coach",
            style = MaterialTheme.typography.headlineLarge,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onSurface,
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp)
        )

        // Chat Message Area
        Box(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
                .padding(horizontal = 16.dp)
        ) {
            if (allMessages.isEmpty()) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Text(
                        text = "Your Coach is ready. Try typing /help or /steps.",
                        style = MaterialTheme.typography.bodyLarge,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            } else {
                LazyColumn(
                    state = listState,
                    reverseLayout = true,
                    modifier = Modifier.fillMaxSize(),
                    verticalArrangement = Arrangement.spacedBy(12.dp, Alignment.Bottom),
                    contentPadding = PaddingValues(vertical = 12.dp)
                ) {
                    items(reversedMessages, key = { it.id }) { msg ->
                        ChatBubble(msg)
                    }
                }
            }
        }

        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.4f))

        // Bottom Input Row
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(MaterialTheme.colorScheme.surface)
                .padding(horizontal = 16.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            OutlinedTextField(
                value = inputText,
                onValueChange = { inputText = it },
                placeholder = { Text("Ask Coach or run command...") },
                shape = CircleShape,
                singleLine = true,
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
                keyboardActions = KeyboardActions(onSend = { handleSend() }),
                modifier = Modifier
                    .weight(1f)
                    .padding(end = 8.dp)
            )

            val isSendEnabled = inputText.trim().isNotEmpty()
            IconButton(
                onClick = { handleSend() },
                enabled = isSendEnabled,
                modifier = Modifier
                    .size(48.dp)
                    .clip(CircleShape)
                    .background(if (isSendEnabled) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceVariant)
            ) {
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.Send,
                    contentDescription = "Send",
                    tint = MaterialTheme.colorScheme.onPrimary,
                    modifier = Modifier.size(20.dp)
                )
            }
        }
    }
}

@Composable
fun ChatBubble(msg: ChatItem) {
    val isUser = msg.isUser
    val alignment = if (isUser) Alignment.End else Alignment.Start

    val bubbleColor = if (isUser) {
        MaterialTheme.colorScheme.primaryContainer
    } else if (msg.isEvent) {
        MaterialTheme.colorScheme.errorContainer
    } else {
        MaterialTheme.colorScheme.surfaceContainerHigh
    }

    val textColor = if (isUser) {
        MaterialTheme.colorScheme.onPrimaryContainer
    } else if (msg.isEvent) {
        MaterialTheme.colorScheme.onErrorContainer
    } else {
        MaterialTheme.colorScheme.onSurface
    }

    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = alignment
    ) {
        Box(
            modifier = Modifier
                .widthIn(max = 310.dp)
                .clip(
                    RoundedCornerShape(
                        topStart = 20.dp,
                        topEnd = 20.dp,
                        bottomStart = if (isUser) 20.dp else 4.dp,
                        bottomEnd = if (isUser) 4.dp else 20.dp
                    )
                )
                .background(bubbleColor)
                .padding(horizontal = 16.dp, vertical = 12.dp)
        ) {
            Column {
                Text(
                    text = msg.text,
                    style = MaterialTheme.typography.bodyLarge,
                    color = textColor
                )

                if (msg.result?.ui == "bmi" && msg.result.bmiPayload != null) {
                    BmiWidget(msg.result.bmiPayload)
                }

                if (msg.result?.ui == "search" && msg.result.searchPayload != null) {
                    SearchWidget(msg.result.searchPayload)
                }
            }
        }
    }
}

enum class BmiCategory(val label: String, val color: @Composable () -> Color) {
    UNDERWEIGHT("Underweight", { MaterialTheme.colorScheme.tertiary }),
    NORMAL("Normal weight", { MaterialTheme.colorScheme.secondary }),
    OVERWEIGHT("Overweight", { MaterialTheme.colorScheme.errorContainer }),
    OBESE("Obese", { MaterialTheme.colorScheme.error }),
    UNKNOWN("Unknown", { MaterialTheme.colorScheme.error })
}

@Composable
fun BmiWidget(payload: BmiPayload) {
    Spacer(modifier = Modifier.height(10.dp))
    Card(
        shape = MaterialTheme.shapes.small,
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceContainer
        ),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            val progress = ((payload.bmi - 15.0) / 25.0).coerceIn(0.0, 1.0).toFloat()
            val categoryEnum = BmiCategory.entries.find { it.label == payload.category } ?: BmiCategory.UNKNOWN
            val barColor = categoryEnum.color()

            Text(
                text = "${payload.category} (${payload.weight} kg, ${payload.height} cm)",
                style = MaterialTheme.typography.labelMedium,
                fontWeight = FontWeight.SemiBold,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Spacer(modifier = Modifier.height(6.dp))

            LinearProgressIndicator(
                progress = { progress },
                color = barColor,
                trackColor = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.3f),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(8.dp)
                    .clip(CircleShape)
            )
        }
    }
}

@Composable
fun SearchWidget(payload: SearchPayload) {
    var page by remember { mutableIntStateOf(0) }
    val total = payload.matches.size
    val currentQuote = payload.matches.getOrNull(page) ?: ""

    Spacer(modifier = Modifier.height(10.dp))
    Card(
        shape = MaterialTheme.shapes.small,
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceContainer
        ),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Text(
                text = "“$currentQuote”",
                style = MaterialTheme.typography.bodyMedium,
                fontStyle = FontStyle.Italic,
                color = MaterialTheme.colorScheme.onSurface
            )

            if (total > 1) {
                Spacer(modifier = Modifier.height(8.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "${page + 1} of $total",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )

                    Row {
                        TextButton(
                            onClick = { if (page > 0) page -= 1 },
                            enabled = page > 0,
                            contentPadding = PaddingValues(horizontal = 8.dp)
                        ) {
                            Text("Prev")
                        }
                        TextButton(
                            onClick = { if (page < total - 1) page += 1 },
                            enabled = page < total - 1,
                            contentPadding = PaddingValues(horizontal = 8.dp)
                        ) {
                            Text("Next")
                        }
                    }
                }
            }
        }
    }
}
