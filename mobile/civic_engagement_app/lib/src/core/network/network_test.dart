import 'package:http/http.dart' as http;
import 'dart:convert';

/// Simple network test utility to debug API connectivity
class NetworkTest {
  static Future<void> testConnection(String baseUrl) async {
    print('🔍 Testing connection to: $baseUrl');
    
    try {
      // Remove /api suffix if present for health check
      final healthUrl = baseUrl.replaceAll('/api', '');
      final uri = Uri.parse('$healthUrl/health');
      
      print('📡 Attempting to connect to: $uri');
      
      final response = await http.get(uri).timeout(
        const Duration(seconds: 5),
        onTimeout: () {
          throw Exception('Connection timeout after 5 seconds');
        },
      );
      
      print('✅ Response Status: ${response.statusCode}');
      print('📦 Response Body: ${response.body}');
      
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        print('✅ Server is healthy: ${data['status']}');
        return;
      } else {
        print('⚠️ Unexpected status code: ${response.statusCode}');
      }
    } catch (e) {
      print('❌ Connection failed: $e');
      print('');
      print('💡 Troubleshooting tips:');
      print('   1. Check if backend is running (npm start in backend folder)');
      print('   2. Verify the IP address is correct');
      print('   3. Make sure phone/emulator is on same network');
      print('   4. For Android emulator, use 10.0.2.2 instead of localhost');
      print('   5. For iOS simulator, use localhost or 127.0.0.1');
    }
  }
  
  static Future<void> testApiEndpoint(String baseUrl) async {
    print('🔍 Testing API endpoint: $baseUrl');
    
    try {
      final uri = Uri.parse('$baseUrl/users/me');
      
      print('📡 Attempting to call: $uri');
      
      final response = await http.get(
        uri,
        headers: {'Accept': 'application/json'},
      ).timeout(
        const Duration(seconds: 5),
      );
      
      print('✅ Response Status: ${response.statusCode}');
      print('📦 Response Body: ${response.body}');
      
      // 401 is expected without token
      if (response.statusCode == 401) {
        print('✅ API is working (401 Unauthorized is expected without token)');
        return;
      }
      
      if (response.statusCode >= 200 && response.statusCode < 300) {
        print('✅ API responded successfully');
        return;
      }
      
      print('⚠️ Unexpected response');
    } catch (e) {
      print('❌ API test failed: $e');
    }
  }
}
