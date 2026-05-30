import 'dart:async';
import 'package:socket_io_client/socket_io_client.dart' as IO;
import '../../features/citizen/data/models/notification_model.dart';
import '../config/app_config.dart';

/// WebSocket service for real-time notifications
/// Implements Socket.IO connection as per backend API Section 12.2
class NotificationSocketService {
  IO.Socket? _socket;
  final StreamController<NotificationModel> _notificationController =
      StreamController<NotificationModel>.broadcast();

  /// Stream of incoming notifications
  Stream<NotificationModel> get notificationStream =>
      _notificationController.stream;

  /// Connection status
  bool get isConnected => _socket?.connected ?? false;

  /// Connect to Socket.IO server
  /// Requires userId for authentication (backend expects it in auth object)
  void connect(String userId, String token) {
    if (_socket?.connected ?? false) {
      print('Socket already connected');
      return;
    }

    // Parse base URL to get socket URL (remove /api suffix)
    final socketUrl = AppConfig.apiBaseUrl.replaceAll('/api', '');

    print('Connecting to Socket.IO at: $socketUrl');
    print('User ID: $userId');

    _socket = IO.io(
      socketUrl,
      IO.OptionBuilder()
          .setTransports(['websocket']) // Use WebSocket transport
          .enableAutoConnect()
          .enableReconnection()
          .setReconnectionAttempts(5)
          .setReconnectionDelay(1000)
          .setAuth({
            'userId': userId, // Backend expects userId in auth object
          })
          .build(),
    );

    _socket!.onConnect((_) {
      print('Socket.IO connected successfully');
    });

    _socket!.onDisconnect((_) {
      print('Socket.IO disconnected');
    });

    _socket!.onConnectError((error) {
      print('Socket.IO connection error: $error');
    });

    _socket!.onError((error) {
      print('Socket.IO error: $error');
    });

    // Listen for 'notification' events (backend API Section 12.2)
    _socket!.on('notification', (data) {
      print('Received notification: $data');
      try {
        final notification = NotificationModel.fromJson(
          data as Map<String, dynamic>,
        );
        _notificationController.add(notification);
      } catch (e) {
        print('Error parsing notification: $e');
      }
    });

    // Reserved for future: 'alert' events
    _socket!.on('alert', (data) {
      print('Received alert: $data');
      // TODO: Handle custom alerts when backend implements them
    });

    _socket!.connect();
  }

  /// Disconnect from Socket.IO server
  void disconnect() {
    print('Disconnecting Socket.IO');
    _socket?.disconnect();
    _socket?.dispose();
    _socket = null;
  }

  /// Dispose resources
  void dispose() {
    disconnect();
    _notificationController.close();
  }
}
