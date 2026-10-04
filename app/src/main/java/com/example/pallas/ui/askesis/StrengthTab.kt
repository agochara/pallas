package com.example.pallas.ui.askesis

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.grid.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.pallas.ui.components.bounceClick
import com.example.pallas.ui.components.pressScale
import com.example.pallas.data.db.ExerciseItem
import com.example.pallas.data.db.LiftRecord
import com.example.pallas.data.db.PallasDatabase
import kotlinx.coroutines.launch
import java.util.Locale

@Composable
fun StrengthTab() {
    val context = LocalContext.current
    val db = remember { PallasDatabase.getInstance(context) }
    val scope = rememberCoroutineScope()

    var exercises by remember { mutableStateOf<List<ExerciseItem>>(AskesisCache.exercises) }
    var maxLiftsMap by remember { mutableStateOf<Map<String, LiftRecord>>(AskesisCache.lifts) }

    var editingExercise by remember { mutableStateOf<ExerciseItem?>(null) }
    var showAddExerciseDialog by remember { mutableStateOf(false) }

    fun loadData() {
        scope.launch {
            val exList = db.getExercises()
            val lifts = db.getAllMaxLifts().associateBy { it.exercise }
            exercises = exList
            maxLiftsMap = lifts
            AskesisCache.exercises = exList
            AskesisCache.lifts = lifts
        }
    }

    LaunchedEffect(Unit) {
        loadData()
    }

    val recorded = exercises.filter { maxLiftsMap.containsKey(it.name) }
    val unrecorded = exercises.filter { !maxLiftsMap.containsKey(it.name) }
    val existingNames = remember(exercises) { exercises.map { it.name }.toSet() }

    Box(modifier = Modifier.fillMaxSize()) {
        LazyVerticalGrid(
            columns = GridCells.Fixed(2),
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(14.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
            contentPadding = PaddingValues(top = 12.dp, bottom = 88.dp)
        ) {
            // Header Row: Span across both columns
            item(span = { GridItemSpan(2) }) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 6.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Strength",
                        style = MaterialTheme.typography.headlineLarge,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                }
            }

            // Recorded Exercise Cards with M3 Expressive semantic color-blocking (Weighted vs Bodyweight)
            items(recorded, key = { it.name }) { ex ->
                val lift = maxLiftsMap[ex.name]
                LiftCard(
                    exercise = ex,
                    record = lift,
                    onEditClick = { editingExercise = ex }
                )
            }

            // Unrecorded Exercises Header
            if (unrecorded.isNotEmpty()) {
                item(span = { GridItemSpan(2) }) {
                    Spacer(modifier = Modifier.height(10.dp))
                }

                // Unrecorded Exercises List
                items(unrecorded, key = { "unrecorded_${it.name}" }, span = { GridItemSpan(2) }) { ex ->
                    UnrecordedExerciseCard(
                        exercise = ex,
                        onLogClick = { editingExercise = ex }
                    )
                }
            }
        }

        // Floating Action Button with spring physics and M3 Expressive shape
        ExtendedFloatingActionButton(
            onClick = { showAddExerciseDialog = true },
            icon = { Icon(Icons.Outlined.Add, contentDescription = null) },
            text = { Text("Add exercise", fontWeight = FontWeight.SemiBold) },
            shape = RoundedCornerShape(18.dp),
            containerColor = MaterialTheme.colorScheme.primaryContainer,
            contentColor = MaterialTheme.colorScheme.onPrimaryContainer,
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(end = 20.dp, bottom = 20.dp)
                .bounceClick { showAddExerciseDialog = true }
        )
    }

    // Add Custom Exercise Dialog (Only Two Types: Weighted and Bodyweight)
    if (showAddExerciseDialog) {
        AddExerciseDialog(
            existingNames = existingNames,
            onDismiss = { showAddExerciseDialog = false },
            onAdd = { name, type, onError ->
                scope.launch {
                    val result = db.addCustomExercise(name, type)
                    if (result != -1L) {
                        loadData()
                        showAddExerciseDialog = false
                    } else {
                        onError()
                    }
                }
            }
        )
    }

    // Edit/Log Lift Dialog
    editingExercise?.let { ex ->
        val currentRecord = maxLiftsMap[ex.name]
        EditLiftDialog(
            exercise = ex,
            currentRecord = currentRecord,
            onDismiss = { editingExercise = null },
            onSave = { weight, reps ->
                scope.launch {
                    db.setLift(ex.name, weight, reps)
                    loadData()
                    editingExercise = null
                }
            },
            onDeleteRecord = {
                scope.launch {
                    db.deleteLift(ex.name)
                    loadData()
                    editingExercise = null
                }
            },
            onDeleteCustomExercise = if (ex.isCustom) {
                {
                    scope.launch {
                        db.deleteCustomExercise(ex.name)
                        loadData()
                        editingExercise = null
                    }
                }
            } else null
        )
    }
}

private data class CardTonalScheme(
    val containerColor: Color,
    val onContainerColor: Color,
    val accentColor: Color,
    val pillContainer: Color,
    val pillContent: Color
)

@Composable
fun LiftCard(
    exercise: ExerciseItem,
    record: LiftRecord?,
    onEditClick: () -> Unit
) {
    val isBodyweight = exercise.type.equals("bodyweight", ignoreCase = true)
    val scheme = if (isBodyweight) {
        CardTonalScheme(
            containerColor = MaterialTheme.colorScheme.tertiaryContainer,
            onContainerColor = MaterialTheme.colorScheme.onTertiaryContainer,
            accentColor = MaterialTheme.colorScheme.tertiary,
            pillContainer = MaterialTheme.colorScheme.surface.copy(alpha = 0.65f),
            pillContent = MaterialTheme.colorScheme.onTertiaryContainer
        )
    } else {
        CardTonalScheme(
            containerColor = MaterialTheme.colorScheme.primaryContainer,
            onContainerColor = MaterialTheme.colorScheme.onPrimaryContainer,
            accentColor = MaterialTheme.colorScheme.primary,
            pillContainer = MaterialTheme.colorScheme.surface.copy(alpha = 0.65f),
            pillContent = MaterialTheme.colorScheme.onPrimaryContainer
        )
    }

    Card(
        onClick = onEditClick,
        shape = RoundedCornerShape(28.dp),
        colors = CardDefaults.cardColors(
            containerColor = scheme.containerColor
        ),
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 180.dp)
            .height(200.dp)
            .pressScale()
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(vertical = 18.dp, horizontal = 8.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Top
        ) {
            Text(
                text = exercise.name.uppercase(Locale.US),
                style = MaterialTheme.typography.labelMedium,
                fontWeight = FontWeight.Bold,
                letterSpacing = 1.2.sp,
                color = scheme.onContainerColor.copy(alpha = 0.85f),
                textAlign = TextAlign.Center,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )

            Spacer(modifier = Modifier.weight(1f))

            if (record != null) {
                if (isBodyweight) {
                    val weightText = if (record.weight > 0.0) {
                        val wStr = if (record.weight % 1.0 == 0.0) "${record.weight.toInt()}" else "${record.weight}"
                        "${wStr}kg"
                    } else {
                        "BW"
                    }
                    val displayText = "$weightText × ${record.reps}"

                    BoxWithConstraints(
                        modifier = Modifier.fillMaxWidth(),
                        contentAlignment = Alignment.Center
                    ) {
                        val calculatedFontSize = when {
                            displayText.length >= 10 -> 24.sp
                            displayText.length >= 8 -> 26.sp
                            displayText.length >= 6 -> 27.sp
                            else -> 28.sp
                        }
                        Text(
                            text = displayText,
                            fontSize = calculatedFontSize,
                            fontWeight = FontWeight.Bold,
                            color = scheme.accentColor,
                            textAlign = TextAlign.Center,
                            maxLines = 1,
                            softWrap = false
                        )
                    }
                } else {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(
                            text = if (record.weight % 1.0 == 0.0) "${record.weight.toInt()}" else "${record.weight}",
                            fontSize = 44.sp,
                            fontWeight = FontWeight.Bold,
                            color = scheme.accentColor,
                            textAlign = TextAlign.Center,
                            maxLines = 1
                        )
                        Spacer(modifier = Modifier.height(2.dp))
                        Text(
                            text = "kg × ${record.reps}",
                            style = MaterialTheme.typography.bodyMedium,
                            fontWeight = FontWeight.SemiBold,
                            color = scheme.onContainerColor.copy(alpha = 0.75f),
                            maxLines = 1
                        )
                    }
                }
            } else {
                Text(
                    text = "No PR",
                    style = MaterialTheme.typography.bodyLarge,
                    color = scheme.onContainerColor.copy(alpha = 0.6f)
                )
            }

            Spacer(modifier = Modifier.weight(1f))
        }
    }
}

@Composable
fun UnrecordedExerciseCard(
    exercise: ExerciseItem,
    onLogClick: () -> Unit
) {
    val isBodyweight = exercise.type.equals("bodyweight", ignoreCase = true)
    Card(
        onClick = onLogClick,
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceContainerLow
        ),
        modifier = Modifier
            .fillMaxWidth()
            .pressScale()
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 18.dp, vertical = 14.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f, fill = false)) {
                Text(
                    text = exercise.name,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onSurface,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Spacer(modifier = Modifier.height(2.dp))
                val typeLabel = if (isBodyweight) "Bodyweight" else "Weighted"
                Text(
                    text = "$typeLabel · No record set",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            Spacer(modifier = Modifier.width(8.dp))

            Surface(
                shape = CircleShape,
                color = MaterialTheme.colorScheme.surfaceContainerHighest,
                modifier = Modifier.clip(CircleShape)
            ) {
                Text(
                    text = "+ LOG",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = if (isBodyweight) MaterialTheme.colorScheme.tertiary else MaterialTheme.colorScheme.primary,
                    modifier = Modifier.padding(horizontal = 14.dp, vertical = 6.dp)
                )
            }
        }
    }
}

@Composable
fun EditLiftDialog(
    exercise: ExerciseItem,
    currentRecord: LiftRecord?,
    onDismiss: () -> Unit,
    onSave: (Double, Int) -> Unit,
    onDeleteRecord: () -> Unit,
    onDeleteCustomExercise: (() -> Unit)?
) {
    val isBodyweight = exercise.type.equals("bodyweight", ignoreCase = true)
    var weightText by remember(currentRecord) {
        mutableStateOf(currentRecord?.weight?.let { if (it % 1.0 == 0.0) it.toInt().toString() else it.toString() } ?: if (isBodyweight) "0" else "")
    }
    var repsText by remember(currentRecord) { mutableStateOf(currentRecord?.reps?.toString() ?: "5") }

    val cleanWeight = weightText.replace(',', '.').trim()
    val weightVal = cleanWeight.toDoubleOrNull()
    val repsVal = repsText.trim().toIntOrNull()
    val isWeightValid = weightVal != null && weightVal in 0.0..1000.0
    val isRepsValid = repsVal != null && repsVal in 1..999

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(exercise.name, fontWeight = FontWeight.Bold) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                // Weight textfield is ALWAYS shown (even in bodyweight, default to 0)
                OutlinedTextField(
                    value = weightText,
                    onValueChange = { weightText = it },
                    label = { Text(if (isBodyweight) "Added Weight (kg, default 0)" else "Weight (kg)") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    isError = weightText.isNotBlank() && !isWeightValid,
                    supportingText = if (weightText.isNotBlank() && !isWeightValid) {
                        { Text("Enter a valid weight (0 - 1000 kg)", color = MaterialTheme.colorScheme.error) }
                    } else null,
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = repsText,
                    onValueChange = { repsText = it },
                    label = { Text("Reps") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    isError = repsText.isNotBlank() && !isRepsValid,
                    supportingText = if (repsText.isNotBlank() && !isRepsValid) {
                        { Text("Enter valid reps (1 - 999)", color = MaterialTheme.colorScheme.error) }
                    } else null,
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                // Dedicated, clearly labeled delete controls
                if (currentRecord != null || onDeleteCustomExercise != null) {
                    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.5f))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        if (currentRecord != null) {
                            OutlinedButton(
                                onClick = onDeleteRecord,
                                colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.error),
                                modifier = Modifier.weight(1f)
                            ) {
                                Text("Delete Record")
                            }
                        }
                        if (onDeleteCustomExercise != null) {
                            OutlinedButton(
                                onClick = onDeleteCustomExercise,
                                colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.error),
                                modifier = Modifier.weight(1f)
                            ) {
                                Text("Delete Exercise")
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    if (isWeightValid && isRepsValid) {
                        onSave(weightVal!!, repsVal!!)
                    }
                },
                enabled = isWeightValid && isRepsValid
            ) {
                Text("Save")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel")
            }
        }
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddExerciseDialog(
    existingNames: Set<String>,
    onDismiss: () -> Unit,
    onAdd: (String, String, () -> Unit) -> Unit
) {
    var name by remember { mutableStateOf("") }
    var type by remember { mutableStateOf("weighted") }
    val types = listOf("weighted", "bodyweight")
    var dbError by remember { mutableStateOf(false) }

    val trimmedName = name.trim()
    val isDuplicate = remember(trimmedName, existingNames) {
        trimmedName.isNotEmpty() && existingNames.any { it.equals(trimmedName, ignoreCase = true) }
    }
    val isError = isDuplicate || dbError

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("New Custom Exercise", fontWeight = FontWeight.Bold) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it; dbError = false },
                    label = { Text("Exercise Name") },
                    isError = isError,
                    supportingText = if (isError) {
                        { Text(if (dbError) "Failed to save: Exercise might already exist" else "An exercise with this name already exists", color = MaterialTheme.colorScheme.error) }
                    } else null,
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                Text(
                    text = "Type",
                    style = MaterialTheme.typography.labelMedium,
                    fontWeight = FontWeight.SemiBold
                )

                SingleChoiceSegmentedButtonRow(modifier = Modifier.fillMaxWidth()) {
                    types.forEachIndexed { index, t ->
                        SegmentedButton(
                            selected = type == t,
                            onClick = { type = t },
                            shape = SegmentedButtonDefaults.itemShape(index = index, count = types.size)
                        ) {
                            Text(if (t == "bodyweight") "Bodyweight" else "Weighted")
                        }
                    }
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    if (trimmedName.isNotBlank() && !isDuplicate) {
                        onAdd(trimmedName, type) {
                            dbError = true
                        }
                    }
                },
                enabled = trimmedName.isNotBlank() && !isDuplicate
            ) {
                Text("Add")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel")
            }
        }
    )
}
