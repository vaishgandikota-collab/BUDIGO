import { GoogleMapsService } from '../src/services/googleMapsService';
import { getSupabase } from '../src/config/supabase';

const TEST_DESTINATIONS = [
  { label: '1. Landmark (Tank Bund)', query: 'Tank Bund' },
  { label: '2. Monument (Charminar)', query: 'Charminar' },
  { label: '3. Water Body (Hussain Sagar)', query: 'Hussain Sagar' },
  { label: '4. Heritage Site (Golconda Fort)', query: 'Golconda Fort' },
  { label: '5. Airport (Hyderabad Airport)', query: 'Hyderabad Airport' },
  { label: '6. Transit Station (Secunderabad Railway Station)', query: 'Secunderabad Railway Station' },
  { label: '7. Beach (Baga Beach)', query: 'Baga Beach' },
  { label: '8. Restaurant (Paradise Biryani Secunderabad)', query: 'Paradise Biryani Secunderabad' },
  { label: '9. College (Osmania University Hyderabad)', query: 'Osmania University Hyderabad' },
  { label: '10. Street Address (100 Feet Road Indiranagar Bengaluru)', query: '100 Feet Road Indiranagar Bengaluru' },
];

const ORIGIN_COORDS = { latitude: 17.385044, longitude: 78.486671 }; // Central Hyderabad

async function runVerification() {
  console.log('================================================================');
  console.log('BUDIGO — 10 REAL-WORLD DESTINATIONS VERIFICATION TEST SUITE');
  console.log('Testing Google Places API (New) & Google Routes API Integration');
  console.log('================================================================\n');

  let passedCount = 0;
  const results: any[] = [];
  const supabase = getSupabase();

  for (const item of TEST_DESTINATIONS) {
    console.log(`\n----------------------------------------------------------------`);
    console.log(`TESTING: ${item.label}`);
    console.log(`Input Query: "${item.query}"`);
    console.log(`----------------------------------------------------------------`);

    const sessionToken = 'sess_' + Math.random().toString(36).substring(2, 10);
    const startTime = Date.now();

    try {
      // 1. Google Places Autocomplete
      const suggestions = await GoogleMapsService.autocompletePlaces(item.query, sessionToken);
      if (!suggestions || suggestions.length === 0) {
        throw new Error(`Autocomplete returned no suggestions for "${item.query}"`);
      }

      const topSuggestion = suggestions[0];
      console.log(`  ✓ Autocomplete Matched: "${topSuggestion.mainText}" (${topSuggestion.fullText})`);
      console.log(`  ✓ Google Place ID: ${topSuggestion.placeId}`);

      // 2. Google Places Details (Extract numerical coordinates)
      const details = await GoogleMapsService.getPlaceDetails(topSuggestion.placeId, sessionToken);
      if (!details || typeof details.latitude !== 'number' || typeof details.longitude !== 'number') {
        throw new Error(`Failed to extract valid numerical latitude/longitude for "${item.query}"`);
      }

      console.log(`  ✓ Coordinates Extracted: Lat ${details.latitude.toFixed(6)}, Lon ${details.longitude.toFixed(6)}`);
      console.log(`  ✓ Formatted Address: ${details.destinationAddress || details.destinationName}`);

      // 3. Google Routes API (Calculate Road Navigation & Polyline)
      const route = await GoogleMapsService.calculateRoute(
        ORIGIN_COORDS,
        { latitude: details.latitude, longitude: details.longitude },
        'DRIVE'
      );

      const distanceKm = (route.distanceMeters / 1000).toFixed(2);
      const durationMins = Math.round(route.durationSeconds / 60);
      const polylineLength = route.encodedPolyline ? route.encodedPolyline.length : 0;

      console.log(`  ✓ Google Routes API Road Distance: ${distanceKm} km (${route.distanceMeters} m)`);
      console.log(`  ✓ Google Routes Travel Duration: ${durationMins} mins (${route.durationSeconds} s)`);
      console.log(`  ✓ Polyline Geometry Encoded: ${polylineLength} chars`);

      // 4. Supabase Room Persistence Verification
      const testRoomCode = 'T' + Math.random().toString(36).substring(2, 7).toUpperCase();
      let supabasePersisted = false;

      if (supabase) {
        const { data: testHost } = await supabase.from('profiles').select('id').limit(1).single();
        if (testHost && testHost.id) {
          const insertPayload: any = {
            room_code: testRoomCode,
            creator_id: testHost.id,
            room_name: `Test: ${item.query}`,
            destination_name: details.destinationName,
            destination_address: details.destinationAddress,
            destination_latitude: details.latitude,
            destination_longitude: details.longitude,
            status: 'active',
          };

          const { data: createdRoom, error: roomError } = await supabase
            .from('rooms')
            .insert(insertPayload)
            .select()
            .single();

          if (!roomError && createdRoom) {
            supabasePersisted = true;
            console.log(`  ✓ Supabase Room Created & Persisted: Room Code "${testRoomCode}" (ID: ${createdRoom.id})`);
            // Clean up test room
            await supabase.from('rooms').delete().eq('id', createdRoom.id);
          } else if (roomError) {
            console.log(`  ℹ Supabase insert note:`, roomError.message);
          }
        }
      }

      passedCount++;
      results.push({
        label: item.label,
        query: item.query,
        matchedName: topSuggestion.mainText,
        fullAddress: details.destinationAddress,
        placeId: details.placeId,
        latitude: details.latitude,
        longitude: details.longitude,
        distanceKm,
        durationMins,
        polylineLength,
        supabasePersisted,
        latencyMs: Date.now() - startTime,
        status: 'PASSED',
      });
    } catch (err: any) {
      console.error(`  ✗ FAILED:`, err.message);
      results.push({
        label: item.label,
        query: item.query,
        status: 'FAILED',
        error: err.message,
      });
    }
  }

  console.log('\n================================================================');
  console.log(`VERIFICATION SUMMARY: ${passedCount}/${TEST_DESTINATIONS.length} DESTINATIONS PASSED`);
  console.log('================================================================');
  console.log(JSON.stringify(results, null, 2));
}

runVerification().catch(console.error);
