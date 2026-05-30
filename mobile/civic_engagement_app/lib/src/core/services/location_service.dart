import 'package:geolocator/geolocator.dart';
import 'package:geocoding/geocoding.dart';

class LocationService {
  Future<String?> getCurrentRegion() async {
    try {
      print('🔍 Starting location detection...');
      
      // Check if location services are enabled
      bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      print('📡 Location services enabled: $serviceEnabled');
      
      if (!serviceEnabled) {
        print('⚠️ Location services disabled, opening settings...');
        // Open location settings automatically
        bool opened = await Geolocator.openLocationSettings();
        print('📱 Settings opened: $opened');
        
        // Return null - user needs to enable and come back
        return null;
      }

      // Check permissions
      LocationPermission permission = await Geolocator.checkPermission();
      print('🔐 Current permission: $permission');
      
      if (permission == LocationPermission.denied) {
        print('⚠️ Permission denied, requesting...');
        permission = await Geolocator.requestPermission();
        print('🔐 New permission: $permission');
        if (permission == LocationPermission.denied) {
          print('❌ Permission denied by user');
          return null;
        }
      }

      if (permission == LocationPermission.deniedForever) {
        print('❌ Permission denied forever, opening app settings...');
        // Open app settings so user can grant permission
        await Geolocator.openAppSettings();
        return null;
      }

      print('✅ Permissions granted, getting position...');
      
      // Get current position with timeout
      Position position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.medium,
          timeLimit: Duration(seconds: 10),
        ),
      ).timeout(
        const Duration(seconds: 12),
        onTimeout: () {
          print('⏱️ Location timeout');
          throw Exception('Location timeout');
        },
      );

      print('📍 Position: ${position.latitude}, ${position.longitude}');
      print('🔄 Reverse geocoding...');

      // Reverse geocode to get address
      List<Placemark> placemarks = await placemarkFromCoordinates(
        position.latitude,
        position.longitude,
      );

      if (placemarks.isNotEmpty) {
        final placemark = placemarks.first;
        print('🏠 Placemark found:');
        print('   - administrativeArea: ${placemark.administrativeArea}');
        print('   - locality: ${placemark.locality}');
        print('   - subAdministrativeArea: ${placemark.subAdministrativeArea}');
        print('   - country: ${placemark.country}');
        
        // Extract region - prioritize administrativeArea (state/region)
        final detectedRegion = placemark.administrativeArea ?? 
                               placemark.locality ?? 
                               placemark.subAdministrativeArea;
        
        print('✅ Detected region: $detectedRegion');
        return detectedRegion;
      }

      print('❌ No placemarks found');
      return null;
    } catch (e, stackTrace) {
      print('❌ Location error: $e');
      print('Stack trace: $stackTrace');
      return null;
    }
  }
}
