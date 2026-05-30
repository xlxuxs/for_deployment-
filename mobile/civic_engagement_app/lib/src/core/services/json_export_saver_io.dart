import 'dart:io';

Future<String> saveJsonExport({
  required String fileName,
  required String jsonText,
}) async {
  final directory = Directory.systemTemp;
  final file = File('${directory.path}${Platform.pathSeparator}$fileName');
  await file.writeAsString(jsonText);
  return file.path;
}
