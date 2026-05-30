class AppConfig {
  const AppConfig._();

  static const apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://192.168.137.142:5002/api',
  );

  static const apiFallbackBaseUrl = String.fromEnvironment(
    'API_FALLBACK_BASE_URL',
    defaultValue: '',
  );

  static List<String> get apiBaseUrls {
    return [
      apiBaseUrl,
      if (apiFallbackBaseUrl.isNotEmpty && apiFallbackBaseUrl != apiBaseUrl)
        apiFallbackBaseUrl,
    ];
  }
}
