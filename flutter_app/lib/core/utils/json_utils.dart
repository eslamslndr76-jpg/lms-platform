/// Shared, defensive JSON value coercion helpers.
///
/// The backend runs libSQL/Turso over HTTP, which can return numbers as
/// strings (`"12"` instead of `12`), booleans as `0/1` or `"1"/"true"`, and
/// occasionally text as a number. Never cast a decoded JSON value directly
/// (`as int`, `as num`, `as bool`, `as String`) — always go through these
/// helpers, which tolerate `num`, numeric strings and `null`.
library;

/// Reads an `int`, accepting `num`, numeric strings (`"12"`, `"12.0"`) and
/// bools (`true` -> 1). Returns [fallback] when the value is missing/invalid.
int toInt(dynamic value, [int fallback = 0]) => toIntOrNull(value) ?? fallback;

/// Same as [toInt] but returns `null` instead of a fallback.
int? toIntOrNull(dynamic value) {
  if (value == null) return null;
  if (value is int) return value;
  if (value is num) {
    if (value.isNaN || value.isInfinite) return null;
    return value.toInt();
  }
  if (value is bool) return value ? 1 : 0;
  if (value is String) {
    final text = value.trim();
    if (text.isEmpty) return null;
    final asInt = int.tryParse(text);
    if (asInt != null) return asInt;
    final asDouble = double.tryParse(text);
    if (asDouble == null || asDouble.isNaN || asDouble.isInfinite) return null;
    return asDouble.toInt();
  }
  return null;
}

/// Reads a `double`, accepting `num` and numeric strings.
double toDouble(dynamic value, [double fallback = 0]) =>
    toDoubleOrNull(value) ?? fallback;

/// Same as [toDouble] but returns `null` instead of a fallback.
double? toDoubleOrNull(dynamic value) {
  if (value == null) return null;
  if (value is double) return value.isFinite ? value : null;
  if (value is num) {
    if (value.isNaN || value.isInfinite) return null;
    return value.toDouble();
  }
  if (value is bool) return value ? 1 : 0;
  if (value is String) {
    final text = value.trim().replaceAll(',', '');
    if (text.isEmpty) return null;
    final parsed = double.tryParse(text);
    if (parsed == null || parsed.isNaN || parsed.isInfinite) return null;
    return parsed;
  }
  return null;
}

/// Reads a `bool`, accepting `true/false`, `1/0` and `"1"/"0"/"true"/"false"`
/// (also `yes/no`, `on/off`). Returns [fallback] when the value is missing or
/// not recognized.
bool toBool(dynamic value, {bool fallback = false}) {
  if (value == null) return fallback;
  if (value is bool) return value;
  if (value is num) {
    if (value.isNaN) return fallback;
    return value != 0;
  }
  if (value is String) {
    switch (value.trim().toLowerCase()) {
      case '1':
      case 'true':
      case 't':
      case 'yes':
      case 'y':
      case 'on':
        return true;
      case '0':
      case 'false':
      case 'f':
      case 'no':
      case 'n':
      case 'off':
      case '':
        return false;
      default:
        return fallback;
    }
  }
  return fallback;
}

/// Reads a `String`; numbers and bools are stringified.
String toStr(dynamic value, [String fallback = '']) {
  if (value == null) return fallback;
  if (value is String) return value;
  return value.toString();
}

/// Same as [toStr] but trims the result and returns `null` when empty.
String? toStrOrNull(dynamic value) {
  if (value == null) return null;
  final text = value is String ? value : value.toString();
  final trimmed = text.trim();
  return trimmed.isEmpty ? null : trimmed;
}

/// Safely reads a JSON object, returning `null` for any other type.
Map<String, dynamic>? toJsonMap(dynamic value) {
  if (value is Map<String, dynamic>) return value;
  if (value is Map) return Map<String, dynamic>.from(value);
  return null;
}

/// Safely reads a JSON array of objects, skipping entries that are not maps.
List<Map<String, dynamic>> toJsonList(dynamic value) {
  if (value is! List) return const [];
  final result = <Map<String, dynamic>>[];
  for (final item in value) {
    final map = toJsonMap(item);
    if (map != null) result.add(map);
  }
  return result;
}
