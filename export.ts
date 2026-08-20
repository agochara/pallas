import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';

import {
  exportDatabaseData,
  importDatabaseData,
} from './db';

export async function exportFitLog() {
  const data = await exportDatabaseData();

  const json = JSON.stringify(data, null, 2);
  const fileUri = FileSystem.cacheDirectory + 'fitlog-backup.json';

  await FileSystem.writeAsStringAsync(fileUri, json, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device.');
  }

  await Sharing.shareAsync(fileUri, {
    mimeType: 'application/json',
    dialogTitle: 'Export FitLog data',
  });
}

export async function importFitLog(): Promise<boolean> {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'application/json',
    copyToCacheDirectory: true,
  });

  if (result.canceled) {
    return false;
  }

  const file = result.assets[0];

  const json = await FileSystem.readAsStringAsync(file.uri, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  const data = JSON.parse(json);

  if (
    !data ||
    !Array.isArray(data.lifts) ||
    !Array.isArray(data.fasts)
  ) {
    throw new Error('Invalid FitLog backup.');
  }

  await importDatabaseData(data);

  return true;
}