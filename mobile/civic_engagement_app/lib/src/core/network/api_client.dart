import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import '../error/api_exception.dart';
import '../session/session_store.dart';
import 'api_result.dart';

class ApiClient {
  ApiClient({
    required http.Client client,
    required SessionStore sessionStore,
    required List<String> baseUrls,
  })  : _client = client,
        _sessionStore = sessionStore,
        _baseUrls = baseUrls;

  final http.Client _client;
  final SessionStore _sessionStore;
  final List<String> _baseUrls;

  static const _timeout = Duration(seconds: 20);

  Future<ApiResult> get(
    String path, {
    Map<String, dynamic>? query,
    bool authenticated = true,
  }) {
    return _send('GET', path, query: query, authenticated: authenticated);
  }

  Future<ApiResult> post(
    String path, {
    Map<String, dynamic>? body,
    bool authenticated = true,
  }) {
    return _send('POST', path, body: body, authenticated: authenticated);
  }

  Future<ApiResult> put(
    String path, {
    Map<String, dynamic>? body,
    bool authenticated = true,
  }) {
    return _send('PUT', path, body: body, authenticated: authenticated);
  }

  Future<ApiResult> patch(
    String path, {
    Map<String, dynamic>? body,
    bool authenticated = true,
  }) {
    return _send('PATCH', path, body: body, authenticated: authenticated);
  }

  Future<ApiResult> delete(String path, {bool authenticated = true}) {
    return _send('DELETE', path, authenticated: authenticated);
  }

  Future<ApiResult> _send(
    String method,
    String path, {
    Map<String, dynamic>? query,
    Map<String, dynamic>? body,
    bool authenticated = true,
  }) async {
    ApiException? lastConnectionError;

    for (final baseUrl in _baseUrls) {
      try {
        return await _sendOnce(
          method,
          path,
          baseUrl: baseUrl,
          query: query,
          body: body,
          authenticated: authenticated,
        );
      } on ApiException catch (error) {
        if (error.statusCode != null) {
          rethrow;
        }
        lastConnectionError = error;
      }
    }

    throw lastConnectionError ??
        ApiException(
          message: 'Could not connect to the server. Check your connection.',
        );
  }

  Future<ApiResult> _sendOnce(
    String method,
    String path, {
    required String baseUrl,
    Map<String, dynamic>? query,
    Map<String, dynamic>? body,
    bool authenticated = true,
  }) async {
    final uri = _uri(baseUrl, path, query);
    final headers = <String, String>{
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    };

    if (authenticated) {
      final token = _sessionStore.token;
      if (token != null) {
        headers['Authorization'] = 'Bearer $token';
      }
    }

    try {
      final encodedBody = body == null ? null : jsonEncode(body);
      final response = await _request(
        method,
        uri,
        headers,
        encodedBody,
      ).timeout(_timeout);
      return _handleResponse(response);
    } on TimeoutException {
      throw ApiException(message: 'The server took too long to respond.');
    } on ApiException {
      rethrow;
    } on FormatException catch (e) {
      print('FormatException: $e');
      throw ApiException(
        message: 'The server returned an invalid response. ${e.message}',
      );
    } on Exception catch (e) {
      print('Exception: $e');
      throw ApiException(
        message: 'Could not connect to the server. Check your connection.',
      );
    }
  }

  Future<http.Response> _request(
    String method,
    Uri uri,
    Map<String, String> headers,
    String? body,
  ) {
    switch (method) {
      case 'GET':
        return _client.get(uri, headers: headers);
      case 'POST':
        return _client.post(uri, headers: headers, body: body);
      case 'PUT':
        return _client.put(uri, headers: headers, body: body);
      case 'PATCH':
        return _client.patch(uri, headers: headers, body: body);
      case 'DELETE':
        return _client.delete(uri, headers: headers);
      default:
        throw ApiException(message: 'Unsupported request method: $method');
    }
  }

  ApiResult _handleResponse(http.Response response) {
    // Add debug logging
    print('Response status: ${response.statusCode}');
    print('Response body: ${response.body}');

    if (response.body.isEmpty) {
      if (response.statusCode >= 200 && response.statusCode < 300) {
        return ApiResult(data: null, message: 'Request completed.');
      }
      throw ApiException(
        message: 'The server returned an empty response.',
        statusCode: response.statusCode,
      );
    }

    final decoded = jsonDecode(response.body);

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw _errorFrom(decoded, response.statusCode);
    }

    if (decoded is Map<String, dynamic>) {
      if (decoded['status'] == 'error') {
        throw _errorFrom(decoded, response.statusCode);
      }
      if (decoded.containsKey('data') || decoded.containsKey('message')) {
        return ApiResult(
          data: decoded['data'],
          message: decoded['message']?.toString() ?? 'Request completed.',
        );
      }
    }

    return ApiResult(data: decoded, message: 'Request completed.');
  }

  ApiException _errorFrom(dynamic decoded, int statusCode) {
    if (statusCode == 429) {
      final parsed = _messageFrom(decoded);
      return ApiException(
        code: _codeFrom(decoded) ?? 'RATE_LIMIT_EXCEEDED',
        message: parsed.isEmpty
            ? 'Too many requests. Please wait and try again.'
            : parsed,
        statusCode: statusCode,
      );
    }

    if (decoded is Map<String, dynamic>) {
      final error = decoded['error'];
      if (error is Map<String, dynamic>) {
        return ApiException(
          code: error['code']?.toString(),
          message: error['message']?.toString() ?? 'Request failed.',
          statusCode: statusCode,
        );
      }
      return ApiException(
        message: decoded['message']?.toString() ??
            decoded['detail']?.toString() ??
            'Request failed.',
        statusCode: statusCode,
      );
    }
    return ApiException(message: 'Request failed.', statusCode: statusCode);
  }

  String _messageFrom(dynamic decoded) {
    if (decoded is Map<String, dynamic>) {
      final error = decoded['error'];
      if (error is Map<String, dynamic>) {
        return error['message']?.toString() ?? '';
      }
      return decoded['message']?.toString() ??
          decoded['detail']?.toString() ??
          '';
    }
    return '';
  }

  String? _codeFrom(dynamic decoded) {
    if (decoded is Map<String, dynamic>) {
      final error = decoded['error'];
      if (error is Map<String, dynamic>) {
        return error['code']?.toString();
      }
    }
    return null;
  }

  Uri _uri(String baseUrl, String path, Map<String, dynamic>? query) {
    final base = Uri.parse(baseUrl);
    final normalizedPath = path.startsWith('/') ? path.substring(1) : path;
    final basePath = base.path.endsWith('/')
        ? base.path.substring(0, base.path.length - 1)
        : base.path;
    final fullPath = '$basePath/$normalizedPath';
    final queryParameters = <String, dynamic>{};

    query?.forEach((key, value) {
      if (value != null) {
        if (value is Iterable) {
          queryParameters[key] = value.map((item) => item.toString()).toList();
        } else {
          queryParameters[key] = value.toString();
        }
      }
    });

    return base.replace(
      path: fullPath,
      queryParameters: queryParameters.isEmpty ? null : queryParameters,
    );
  }
}
