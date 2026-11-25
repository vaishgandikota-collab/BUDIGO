import { ENV } from '../config/env';
import { calculateHaversineDistance, calculateCentroid } from '../algorithms/haversine';
import {
  CandidatePlace,
  GeoCoordinate,
  ParticipantStartPoint,
  DiscoverParticipantInput,
  FairDestinationArea,
  FairMeetingVenue,
} from '../types';

export class GoogleMapsService {
  private static hasGooglePlacesKey(): boolean {
    return Boolean(ENV.GOOGLE_PLACES_API_KEY && ENV.GOOGLE_PLACES_API_KEY.length > 10);
  }

  private static hasGoogleRoutesKey(): boolean {
    return Boolean(ENV.GOOGLE_ROUTES_API_KEY && ENV.GOOGLE_ROUTES_API_KEY.length > 10);
  }

  private static readonly PLACE_TYPE_MAP: Record<string, string[]> = {
    all: ['cafe', 'restaurant', 'tourist_attraction', 'park', 'shopping_mall'],
    cafe: ['cafe', 'coffee_shop'],
    restaurant: ['restaurant'],
    shopping_mall: ['shopping_mall'],
    tourist_attraction: ['tourist_attraction', 'historical_landmark', 'cultural_landmark'],
    park: ['park', 'national_park'],
    hotel: ['hotel', 'lodging'],
    parking: ['parking'],
    transit_station: ['subway_station', 'transit_station', 'bus_station', 'train_station'],
    metro_station: ['subway_station', 'light_rail_station'],
    bus_station: ['bus_station', 'bus_stop'],
    popular_landmarks: ['tourist_attraction', 'historical_landmark'],
  };

  /**
   * Search candidate places nearby using Google Places API (New) Nearby Search
   */
  static async searchNearbyPlaces(
    center: GeoCoordinate,
    category = 'all',
    radiusMeters = 2000
  ): Promise<CandidatePlace[]> {
    if (this.hasGooglePlacesKey()) {
      try {
        const typesToQuery = this.PLACE_TYPE_MAP[category] || [category];
        const url = 'https://places.googleapis.com/v1/places:searchNearby';
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': ENV.GOOGLE_PLACES_API_KEY,
            'X-Goog-FieldMask':
              'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.types,places.primaryTypeDisplayName,places.currentOpeningHours,places.googleMapsUri',
          },
          body: JSON.stringify({
            includedTypes: typesToQuery,
            maxResultCount: 20,
            locationRestriction: {
              circle: {
                center: {
                  latitude: center.latitude,
                  longitude: center.longitude,
                },
                radius: radiusMeters,
              },
            },
          }),
        });

        if (response.ok) {
          const data: any = await response.json();
          if (data.places && data.places.length > 0) {
            return data.places.map((p: any) => ({
              placeId: p.id,
              name: p.displayName?.text || 'Recommended Spot',
              category,
              primaryType: p.primaryTypeDisplayName?.text || (p.types && p.types[0]) || category,
              latitude: p.location.latitude,
              longitude: p.location.longitude,
              address: p.formattedAddress || 'Nearby area',
              rating: typeof p.rating === 'number' ? p.rating : undefined,
              userRatingCount: typeof p.userRatingCount === 'number' ? p.userRatingCount : undefined,
              openNow: p.currentOpeningHours?.openNow,
              openStatusText:
                p.currentOpeningHours?.openNow === true
                  ? 'Open Now'
                  : p.currentOpeningHours?.openNow === false
                  ? 'Closed'
                  : undefined,
              googleMapsUri: p.googleMapsUri,
            }));
          }
        } else if (ENV.NODE_ENV === 'production') {
          throw new Error(`[GoogleMapsService] Google Places API error HTTP ${response.status} in production`);
        }
      } catch (err) {
        if (ENV.NODE_ENV === 'production') throw err;
        console.warn('[GoogleMapsService] Places API call failed, using resilient discovery:', err);
      }
    } else if (ENV.NODE_ENV === 'production') {
      throw new Error('[GoogleMapsService] GOOGLE_PLACES_API_KEY is strictly required in production');
    }

    // High quality resilient candidate generation around center (Isolated to Dev/Test)
    return this.generateCandidatePlacesAroundCenter(center, category);
  }

  /**
   * Search real candidate meeting points near the room's destination,
   * calculate actual road routes from destination, and rank them smartly.
   */
  static async searchDestinationMeetingPoints(
    destination: GeoCoordinate,
    category = 'all',
    radiusMeters = 2000
  ): Promise<CandidatePlace[]> {
    // 1. Discover places around destination
    const rawPlaces = await this.searchNearbyPlaces(destination, category, radiusMeters);
    if (!rawPlaces || rawPlaces.length === 0) {
      return [];
    }

    // 2. Compute road distance and driving duration from destination for each candidate using Routes API
    const scoredPlaces: CandidatePlace[] = await Promise.all(
      rawPlaces.map(async (place) => {
        try {
          const route = await this.calculateRoute(
            destination,
            { latitude: place.latitude, longitude: place.longitude },
            'DRIVE'
          );
          return {
            ...place,
            distanceFromDestMeters: route.distanceMeters,
            drivingTimeFromDestSeconds: route.durationSeconds,
            destRoutePolyline: route.encodedPolyline,
          };
        } catch (routeErr) {
          // Haversine fallback if Routes API fails for an individual point
          const straight = calculateHaversineDistance(destination, {
            latitude: place.latitude,
            longitude: place.longitude,
          });
          const roadDist = Math.round(straight * 1.32);
          const durSec = Math.max(60, Math.round((roadDist / 30000) * 3600));
          return {
            ...place,
            distanceFromDestMeters: roadDist,
            drivingTimeFromDestSeconds: durSec,
          };
        }
      })
    );

    // 3. Smart Ranking Formula:
    // - Proximity score (0-40 pts): closer to destination is better
    // - Road duration score (0-30 pts): faster driving time is better
    // - Rating & reviews score (0-20 pts): higher rating & review count is better
    // - Availability/open status (0-10 pts): open places prioritized
    const maxRadius = Math.max(radiusMeters, 2000);
    const ranked = scoredPlaces.sort((a, b) => {
      const distA = a.distanceFromDestMeters || 1000;
      const distB = b.distanceFromDestMeters || 1000;
      const timeA = a.drivingTimeFromDestSeconds || 300;
      const timeB = b.drivingTimeFromDestSeconds || 300;

      // Distance score (closer = higher)
      const distScoreA = Math.max(0, 40 * (1 - distA / maxRadius));
      const distScoreB = Math.max(0, 40 * (1 - distB / maxRadius));

      // Driving time score (faster = higher, benchmark 15 mins = 900s)
      const timeScoreA = Math.max(0, 30 * (1 - Math.min(timeA, 900) / 900));
      const timeScoreB = Math.max(0, 30 * (1 - Math.min(timeB, 900) / 900));

      // Rating score
      const ratingScoreA = a.rating ? (a.rating / 5) * 15 + Math.min(5, (a.userRatingCount || 0) / 200) : 10;
      const ratingScoreB = b.rating ? (b.rating / 5) * 15 + Math.min(5, (b.userRatingCount || 0) / 200) : 10;

      // Open now bonus
      const openScoreA = a.openNow === true ? 10 : a.openNow === false ? 0 : 5;
      const openScoreB = b.openNow === true ? 10 : b.openNow === false ? 0 : 5;

      const totalA = distScoreA + timeScoreA + ratingScoreA + openScoreA;
      const totalB = distScoreB + timeScoreB + ratingScoreB + openScoreB;

      return totalB - totalA;
    });

    return ranked;
  }

  /**
   * Search candidate places by query text using Google Places API (New) Text Search
   */
  static async searchPlacesByText(
    query: string,
    maxResults = 6
  ): Promise<CandidatePlace[]> {
    if (!query || query.trim().length < 2) {
      return [];
    }

    const trimmed = query.trim();

    if (this.hasGooglePlacesKey()) {
      try {
        const url = 'https://places.googleapis.com/v1/places:searchText';
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': ENV.GOOGLE_PLACES_API_KEY,
            'X-Goog-FieldMask':
              'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.types',
          },
          body: JSON.stringify({
            textQuery: trimmed,
            maxResultCount: maxResults,
          }),
        });

        if (response.ok) {
          const data: any = await response.json();
          if (data.places && data.places.length > 0) {
            return data.places.map((p: any) => ({
              placeId: p.id,
              name: p.displayName?.text || trimmed,
              category: (p.types && p.types[0]) || 'point_of_interest',
              latitude: p.location.latitude,
              longitude: p.location.longitude,
              address: p.formattedAddress || trimmed,
              rating: p.rating || 4.5,
            }));
          }
        } else if (ENV.NODE_ENV === 'production') {
          throw new Error(`[GoogleMapsService] Google Places Search API error HTTP ${response.status}`);
        }
      } catch (err) {
        if (ENV.NODE_ENV === 'production') throw err;
        console.warn('[GoogleMapsService] Places text search failed, using resilient fallback:', err);
      }
    }

    return this.searchResilientPlaces(trimmed);
  }

  /**
   * Search autocomplete suggestions using Google Places API (New) Autocomplete
   */
  static async autocompletePlaces(input: string, sessionToken?: string): Promise<{
    placeId: string;
    mainText: string;
    secondaryText: string;
    fullText: string;
    types?: string[];
  }[]> {
    if (!input || input.trim().length < 2) return [];

    const trimmed = input.trim();

    if (this.hasGooglePlacesKey()) {
      try {
        const url = 'https://places.googleapis.com/v1/places:autocomplete';
        const body: Record<string, any> = {
          input: trimmed,
          languageCode: 'en',
          regionCode: 'in',
        };
        if (sessionToken) {
          body.sessionToken = sessionToken;
        }

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': ENV.GOOGLE_PLACES_API_KEY,
          },
          body: JSON.stringify(body),
        });

        if (response.ok) {
          const data: any = await response.json();
          if (data.suggestions && data.suggestions.length > 0) {
            return data.suggestions
              .filter((s: any) => s.placePrediction)
              .map((s: any) => {
                const pred = s.placePrediction;
                return {
                  placeId: pred.placeId || pred.place?.replace('places/', ''),
                  mainText: pred.structuredFormat?.mainText?.text || pred.text?.text || trimmed,
                  secondaryText: pred.structuredFormat?.secondaryText?.text || '',
                  fullText: pred.text?.text || trimmed,
                  types: pred.types || [],
                };
              });
          }
        }
      } catch (err) {
        console.warn('[GoogleMapsService] Autocomplete failed, falling back to text search:', err);
      }
    }

    // Fallback: search resilient places
    const fallbackPlaces = this.searchResilientPlaces(trimmed);
    return fallbackPlaces.map((p) => ({
      placeId: p.placeId,
      mainText: p.name,
      secondaryText: p.address,
      fullText: `${p.name}, ${p.address}`,
      types: [p.category],
    }));
  }

  /**
   * Fetch exact Place Details (coordinates, address, name) by placeId using Google Places API (New)
   */
  static async getPlaceDetails(placeId: string, sessionToken?: string): Promise<{
    destinationName: string;
    destinationAddress: string;
    placeId: string;
    latitude: number;
    longitude: number;
  }> {
    if (!placeId) throw new Error('placeId is required');

    if (this.hasGooglePlacesKey()) {
      try {
        const queryParams = sessionToken ? `?sessionToken=${encodeURIComponent(sessionToken)}` : '';
        const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}${queryParams}`;
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': ENV.GOOGLE_PLACES_API_KEY,
            'X-Goog-FieldMask': 'id,displayName,formattedAddress,location,types',
          },
        });

        if (response.ok) {
          const data: any = await response.json();
          if (data.location && typeof data.location.latitude === 'number' && typeof data.location.longitude === 'number') {
            return {
              destinationName: data.displayName?.text || 'Selected Destination',
              destinationAddress: data.formattedAddress || '',
              placeId: data.id || placeId,
              latitude: data.location.latitude,
              longitude: data.location.longitude,
            };
          }
        }
      } catch (err) {
        console.warn('[GoogleMapsService] Place details failed, checking curated database:', err);
      }
    }

    // Fallback: search resilient places
    const curated = this.searchResilientPlaces(placeId);
    if (curated.length > 0) {
      const top = curated[0];
      return {
        destinationName: top.name,
        destinationAddress: top.address,
        placeId: top.placeId,
        latitude: top.latitude,
        longitude: top.longitude,
      };
    }

    throw new Error(`Unable to fetch coordinates for place ID: ${placeId}`);
  }



  /**
   * Calculates actual road route between origin and destination using Google Routes API
   */
  static async calculateRoute(
    origin: GeoCoordinate,
    destination: GeoCoordinate,
    travelMode: 'DRIVE' | 'WALK' | 'BICYCLE' = 'DRIVE'
  ): Promise<{
    distanceMeters: number;
    durationSeconds: number;
    encodedPolyline: string;
  }> {
    if (this.hasGoogleRoutesKey()) {
      try {
        const url = 'https://routes.googleapis.com/directions/v2:computeRoutes';
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': ENV.GOOGLE_ROUTES_API_KEY,
            'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline',
          },
          body: JSON.stringify({
            origin: {
              location: {
                latLng: {
                  latitude: origin.latitude,
                  longitude: origin.longitude,
                },
              },
            },
            destination: {
              location: {
                latLng: {
                  latitude: destination.latitude,
                  longitude: destination.longitude,
                },
              },
            },
            travelMode,
            routingPreference: travelMode === 'DRIVE' ? 'TRAFFIC_AWARE' : undefined,
          }),
        });

        if (response.ok) {
          const data: any = await response.json();
          if (data.routes && data.routes[0]) {
            const r = data.routes[0];
            const durationSec = parseInt(r.duration.replace('s', ''), 10) || 600;
            return {
              distanceMeters: r.distanceMeters,
              durationSeconds: durationSec,
              encodedPolyline: r.polyline?.encodedPolyline || '',
            };
          }
        } else if (ENV.NODE_ENV === 'production') {
          throw new Error(`[GoogleMapsService] Google Routes API error HTTP ${response.status} in production`);
        }
      } catch (err) {
        if (ENV.NODE_ENV === 'production') throw err;
        console.warn('[GoogleMapsService] Routes API call failed, using road network model:', err);
      }
    } else if (ENV.NODE_ENV === 'production') {
      throw new Error('[GoogleMapsService] GOOGLE_ROUTES_API_KEY is strictly required in production');
    }

    // Road model simulation based on realistic road network multiplier (Isolated to Dev/Test)
    const straightDist = calculateHaversineDistance(origin, destination);
    // Road circuity factor in urban/regional networks is ~1.32
    const roadDistanceMeters = Math.round(straightDist * 1.32);

    // Realistic vehicle speed based on distance (30 km/h in dense, 50 km/h in suburban)
    const speedKmh = roadDistanceMeters < 5000 ? 30 : 45;
    const speedMs = (speedKmh * 1000) / 3600;
    const durationSeconds = Math.max(120, Math.round(roadDistanceMeters / speedMs));

    // Simple encoded polyline representation
    const encodedPolyline = this.generateSamplePolyline(origin, destination);

    return {
      distanceMeters: roadDistanceMeters,
      durationSeconds,
      encodedPolyline,
    };
  }

  /**
   * Computes route matrix from multiple origins to multiple candidate destinations
   */
  static async computeRouteMatrix(
    origins: ParticipantStartPoint[],
    destinations: CandidatePlace[]
  ): Promise<Map<string, Map<string, { distanceMeters: number; durationSeconds: number }>>> {
    const matrix = new Map<string, Map<string, { distanceMeters: number; durationSeconds: number }>>();

    // Initialize map
    for (const d of destinations) {
      matrix.set(d.placeId, new Map());
    }

    // If Google Routes Compute Route Matrix is enabled
    if (this.hasGoogleRoutesKey() && origins.length > 0 && destinations.length > 0) {
      try {
        const url = 'https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix';
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': ENV.GOOGLE_ROUTES_API_KEY,
            'X-Goog-FieldMask':
              'originIndex,destinationIndex,status,condition,distanceMeters,duration',
          },
          body: JSON.stringify({
            origins: origins.map((o) => ({
              waypoint: { location: { latLng: { latitude: o.latitude, longitude: o.longitude } } },
            })),
            destinations: destinations.map((d) => ({
              waypoint: { location: { latLng: { latitude: d.latitude, longitude: d.longitude } } },
            })),
            travelMode: 'DRIVE',
            routingPreference: 'TRAFFIC_AWARE',
          }),
        });

        if (response.ok) {
          const matrixData: any = await response.json();
          if (Array.isArray(matrixData)) {
            for (const item of matrixData) {
              const orig = origins[item.originIndex];
              const dest = destinations[item.destinationIndex];
              if (orig && dest && item.status?.code !== 'NOT_FOUND') {
                const dur = parseInt((item.duration || '600s').replace('s', ''), 10);
                matrix.get(dest.placeId)!.set(orig.userId, {
                  distanceMeters: item.distanceMeters || 3000,
                  durationSeconds: dur || 600,
                });
              }
            }
          }
        } else if (ENV.NODE_ENV === 'production') {
          throw new Error(`[GoogleMapsService] ComputeRouteMatrix API error HTTP ${response.status} in production`);
        }
      } catch (err) {
        if (ENV.NODE_ENV === 'production') throw err;
        console.warn('[GoogleMapsService] Route matrix API failed, using network model fallback:', err);
      }
    } else if (ENV.NODE_ENV === 'production') {
      throw new Error('[GoogleMapsService] GOOGLE_ROUTES_API_KEY is strictly required in production for computeRouteMatrix');
    }

    // Ensure every (dest, orig) pair in the matrix is populated (fills any missing pair from API)
    for (const dest of destinations) {
      const destMap = matrix.get(dest.placeId)!;
      for (const orig of origins) {
        if (!destMap.has(orig.userId)) {
          const straight = calculateHaversineDistance(
            { latitude: orig.latitude, longitude: orig.longitude },
            { latitude: dest.latitude, longitude: dest.longitude }
          );
          const roadDistance = Math.round(straight * 1.32);
          const speedKmh = roadDistance < 5000 ? 30 : 45;
          const durationSec = Math.max(120, Math.round(roadDistance / ((speedKmh * 1000) / 3600)));

          destMap.set(orig.userId, {
            distanceMeters: roadDistance,
            durationSeconds: durationSec,
          });
        }
      }
    }

    return matrix;
  }

  private static generateCandidatePlacesAroundCenter(
    center: GeoCoordinate,
    category: string
  ): CandidatePlace[] {
    const categoryTemplates: Record<string, { names: string[]; addresses: string[] }> = {
      cafe: {
        names: ['Artisan Roastery & Café', 'The Daily Grind Bistro', 'Brew & Bloom Coffeehouse', 'Blue Tokai Coffee Lounge'],
        addresses: ['Main Promenade, Central Hub', '42 Heritage Blvd', 'Market Square, Unit 3', 'Green Park Avenue'],
      },
      restaurant: {
        names: ['Spice Symphony Grill', 'Olive & Basil Trattoria', 'Coastal Horizon Diner', 'Urban Fork Kitchen'],
        addresses: ['Sunset Strip, Bayview', '15 High St, Downtown', 'Grand Central Plaza', 'Riverside Walkway'],
      },
      shopping_mall: {
        names: ['Grand City Mall & Galleria', 'Metropolis Center', 'The Pavilion Shopping Hub', 'Phoenix Promenade'],
        addresses: ['Ring Road Junction', 'Commercial Blvd, Sector 4', 'Central Boulevard', 'Highway Plaza'],
      },
      metro_station: {
        names: ['Central Interchange Station', 'City Center Metro Hub', 'Parkview Transit Junction', 'North Terminal'],
        addresses: ['Station Rd, Transit Plaza', 'Gate 2, Commercial Axis', 'Metro Complex', 'Terminal Way'],
      },
      bus_station: {
        names: ['Central Bus Terminal', 'Interstate Transit Depot', 'City Express Bus Stand', 'Crossroads Bus Interchange'],
        addresses: ['Bus Terminal Rd', 'National Highway Junction', 'Transit Hub Gate 1', 'Main Ring Road'],
      },
      popular_landmarks: {
        names: ['Historic Heritage Fort & Viewpoint', 'The Clock Tower Plaza', 'Sunset Sea Point Promenade', 'Royal Memorial Gardens'],
        addresses: ['Hilltop Viewpoint Rd', 'Central Square Heritage Zone', 'Marine Esplanade', 'Palace Gate Road'],
      },
      park: {
        names: ['Central Botanical Gardens', 'Riverside Eco Park', 'Green Meadows Civic Park', 'Sunset Lakefront Park'],
        addresses: ['Botanical Garden Rd', 'Riverfront Walkway', 'Green Valley Blvd', 'Lakeside Crescent'],
      },
    };

    const template = categoryTemplates[category] || categoryTemplates.cafe;

    // Disperse candidates around the geographic center by small offsets (approx 400m - 1800m)
    const offsets = [
      { dLat: 0.004, dLon: 0.003, rating: 4.8 },
      { dLat: -0.003, dLon: -0.005, rating: 4.6 },
      { dLat: 0.006, dLon: -0.004, rating: 4.5 },
      { dLat: -0.005, dLon: 0.006, rating: 4.3 },
    ];

    return offsets.map((off, idx) => ({
      placeId: `cand_place_${category}_${idx + 1}`,
      name: template.names[idx % template.names.length],
      category,
      latitude: Number((center.latitude + off.dLat).toFixed(5)),
      longitude: Number((center.longitude + off.dLon).toFixed(5)),
      address: template.addresses[idx % template.addresses.length],
      rating: off.rating,
    }));
  }

  static encodeCoordinates(points: { latitude: number; longitude: number }[]): string {
    let output = '';
    let prevLat = 0;
    let prevLng = 0;

    for (const point of points) {
      const lat = Math.round(point.latitude * 1e5);
      const lng = Math.round(point.longitude * 1e5);
      output += GoogleMapsService.encodeValue(lat - prevLat);
      output += GoogleMapsService.encodeValue(lng - prevLng);
      prevLat = lat;
      prevLng = lng;
    }
    return output;
  }

  private static encodeValue(val: number): string {
    let num = val < 0 ? ~(val << 1) : val << 1;
    let str = '';
    while (num >= 0x20) {
      str += String.fromCharCode((0x20 | (num & 0x1f)) + 63);
      num >>= 5;
    }
    str += String.fromCharCode(num + 63);
    return str;
  }

  private static generateSamplePolyline(orig: GeoCoordinate, dest: GeoCoordinate): string {
    // Generate realistic road curvature waypoints between orig and dest
    const dLat = dest.latitude - orig.latitude;
    const dLon = dest.longitude - orig.longitude;

    const mid1 = {
      latitude: Number((orig.latitude + dLat * 0.33 + 0.0018).toFixed(5)),
      longitude: Number((orig.longitude + dLon * 0.33 - 0.0015).toFixed(5)),
    };
    const mid2 = {
      latitude: Number((orig.latitude + dLat * 0.67 - 0.0012).toFixed(5)),
      longitude: Number((orig.longitude + dLon * 0.67 + 0.0022).toFixed(5)),
    };

    return GoogleMapsService.encodeCoordinates([orig, mid1, mid2, dest]);
  }

  private static searchResilientPlaces(query: string): CandidatePlace[] {
    const q = query.toLowerCase();
    const curatedDatabase: CandidatePlace[] = [
      {
        placeId: 'cand_res_1',
        name: 'Taj Mahal',
        category: 'tourist_attraction',
        latitude: 27.1751,
        longitude: 78.0421,
        address: 'Dharmapuri, Forest Colony, Tajganj, Agra, Uttar Pradesh 282001',
        rating: 4.8,
      },
      {
        placeId: 'cand_res_2',
        name: 'Baga Beach',
        category: 'tourist_attraction',
        latitude: 15.5553,
        longitude: 73.7517,
        address: 'Baga Beach Rd, Calangute, Goa 403516',
        rating: 4.6,
      },
      {
        placeId: 'cand_res_3',
        name: 'Marine Drive Promenade',
        category: 'tourist_attraction',
        latitude: 18.9432,
        longitude: 72.8236,
        address: 'Netaji Subhash Chandra Bose Rd, Mumbai 400020',
        rating: 4.7,
      },
      {
        placeId: 'cand_res_4',
        name: 'Connaught Place Central Hub',
        category: 'shopping_mall',
        latitude: 28.6315,
        longitude: 77.2167,
        address: 'Connaught Circle, New Delhi 110001',
        rating: 4.5,
      },
      {
        placeId: 'cand_res_5',
        name: 'Indiranagar 100ft Road',
        category: 'point_of_interest',
        latitude: 12.9784,
        longitude: 77.6408,
        address: 'Indiranagar, Bengaluru, Karnataka 560038',
        rating: 4.6,
      },
      {
        placeId: 'cand_res_6',
        name: 'Cubbon Park',
        category: 'park',
        latitude: 12.9763,
        longitude: 77.5929,
        address: 'Kasturba Rd, Sampangi Rama Nagar, Bengaluru, Karnataka 560001',
        rating: 4.7,
      },
      {
        placeId: 'cand_res_7',
        name: 'Gateway of India',
        category: 'tourist_attraction',
        latitude: 18.9220,
        longitude: 72.8347,
        address: 'Apollo Bandar, Colaba, Mumbai, Maharashtra 400001',
        rating: 4.8,
      },
      {
        placeId: 'cand_res_8',
        name: 'India Gate',
        category: 'historical_landmark',
        latitude: 28.6129,
        longitude: 77.2295,
        address: 'Kartavya Path, India Gate, New Delhi 110001',
        rating: 4.7,
      },
      {
        placeId: 'cand_res_9',
        name: 'Hawa Mahal',
        category: 'tourist_attraction',
        latitude: 26.9239,
        longitude: 75.8267,
        address: 'Hawa Mahal Rd, Badi Choupad, J.D.A. Market, Jaipur, Rajasthan 302002',
        rating: 4.6,
      },
      {
        placeId: 'cand_res_10',
        name: 'Charminar',
        category: 'historical_landmark',
        latitude: 17.3616,
        longitude: 78.4747,
        address: 'Charminar Rd, Char Kaman, Ghansi Bazaar, Hyderabad, Telangana 500002',
        rating: 4.5,
      },
      {
        placeId: 'cand_res_11',
        name: 'Calangute Beach',
        category: 'tourist_attraction',
        latitude: 15.5442,
        longitude: 73.7553,
        address: 'Calangute Beach, North Goa 403516',
        rating: 4.4,
      },
      {
        placeId: 'cand_res_12',
        name: 'Fort Aguada',
        category: 'historical_landmark',
        latitude: 15.4920,
        longitude: 73.7737,
        address: 'Aguada Fort Rd, Candolim, Goa 403515',
        rating: 4.6,
      },
      {
        placeId: 'cand_res_13',
        name: 'Anjuna Beach',
        category: 'tourist_attraction',
        latitude: 15.5733,
        longitude: 73.7411,
        address: 'Anjuna, Bardez, Goa 403509',
        rating: 4.5,
      },
      {
        placeId: 'cand_res_14',
        name: 'Lalbagh Botanical Garden',
        category: 'park',
        latitude: 12.9507,
        longitude: 77.5848,
        address: 'Mavalli, Bengaluru, Karnataka 560004',
        rating: 4.6,
      },
    ];

    const matches = curatedDatabase.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.address.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
    );

    if (matches.length > 0) {
      return matches;
    }

    // Hash query to generate consistent fallback coordinates
    let hash = 0;
    for (let i = 0; i < query.length; i++) {
      hash = (hash << 5) - hash + query.charCodeAt(i);
      hash |= 0;
    }
    const latOffset = ((Math.abs(hash) % 1000) / 1000) * 0.1 - 0.05;
    const lonOffset = (((Math.abs(hash) >> 3) % 1000) / 1000) * 0.1 - 0.05;

    return [
      {
        placeId: `custom_place_${Math.abs(hash)}`,
        name: query,
        category: 'point_of_interest',
        latitude: Number((15.5 + latOffset).toFixed(5)),
        longitude: Number((73.8 + lonOffset).toFixed(5)),
        address: `${query}, Target Destination`,
        rating: 4.5,
      },
    ];
  }

  /**
   * Reverse geocodes coordinates to a readable address and place name
   */
  static async reverseGeocode(coordinate: GeoCoordinate): Promise<{
    formattedAddress: string;
    name: string;
    placeId?: string;
  }> {
    if (this.hasGooglePlacesKey()) {
      try {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${coordinate.latitude},${coordinate.longitude}&key=${ENV.GOOGLE_PLACES_API_KEY}`;
        const resp = await fetch(url);
        if (resp.ok) {
          const data: any = await resp.json();
          if (data.results && data.results.length > 0) {
            const top = data.results[0];
            const name = top.address_components?.[0]?.long_name || top.formatted_address.split(',')[0];
            return {
              formattedAddress: top.formatted_address,
              name,
              placeId: top.place_id,
            };
          }
        }
      } catch (err) {
        console.warn('[GoogleMapsService] Reverse geocode API call failed:', err);
      }
    }

    return {
      formattedAddress: `${coordinate.latitude.toFixed(4)}, ${coordinate.longitude.toFixed(4)}`,
      name: `Location (${coordinate.latitude.toFixed(4)}, ${coordinate.longitude.toFixed(4)})`,
    };
  }

  /**
   * Tier 1 Discovery: Discovers and ranks fair destination areas / districts
   * Evaluates actual road travel time from every participant to candidate hubs
   */
  static async discoverFairDestinationAreas(
    participants: DiscoverParticipantInput[],
    travelMode: 'DRIVE' | 'WALK' | 'BICYCLE' = 'DRIVE'
  ): Promise<{
    center: GeoCoordinate;
    candidateAreas: FairDestinationArea[];
  }> {
    if (participants.length < 2) {
      throw new Error('At least 2 participants are required to find a fair meeting area.');
    }

    // 1. Calculate centroid of all participants
    const center = calculateCentroid(
      participants.map((p) => ({ latitude: p.latitude, longitude: p.longitude }))
    );

    // 2. Query Google Places for candidate commercial areas/districts around the centroid
    let candidateLocations: { name: string; address: string; latitude: number; longitude: number; category: string }[] = [];

    if (this.hasGooglePlacesKey()) {
      try {
        const placesResp = await this.searchNearbyPlaces(center, 'all', 6000);
        if (placesResp && placesResp.length > 0) {
          for (const p of placesResp) {
            candidateLocations.push({
              name: p.name,
              address: p.address,
              latitude: p.latitude,
              longitude: p.longitude,
              category: p.category || 'commercial_hub',
            });
          }
        }
      } catch (err) {
        console.warn('[GoogleMapsService] Error searching nearby places around center:', err);
      }
    }

    // Curated prominent regional commercial hubs as guaranteed high-quality anchors
    const CURATED_HUBS: { name: string; address: string; latitude: number; longitude: number; category: string }[] = [
      {
        name: 'Banjara Hills / Road No. 12',
        address: 'Banjara Hills Central Hub, Hyderabad, Telangana',
        latitude: 17.4156,
        longitude: 78.4357,
        category: 'shopping_dining',
      },
      {
        name: 'Jubilee Hills Checkpost',
        address: 'Jubilee Hills Central District, Hyderabad, Telangana',
        latitude: 17.4319,
        longitude: 78.4073,
        category: 'lifestyle_hub',
      },
      {
        name: 'Begumpet / Prakash Nagar',
        address: 'Begumpet Commercial Corridor, Hyderabad, Telangana',
        latitude: 17.4447,
        longitude: 78.4664,
        category: 'transit_dining',
      },
      {
        name: 'Somajiguda / Raj Bhavan Rd',
        address: 'Somajiguda Central Hub, Hyderabad, Telangana',
        latitude: 17.4243,
        longitude: 78.4552,
        category: 'central_business',
      },
      {
        name: 'Tank Bund / Hussain Sagar Promenade',
        address: 'Tank Bund Promenade, Hyderabad, Telangana',
        latitude: 17.4239,
        longitude: 78.4738,
        category: 'lakefront_attraction',
      },
      {
        name: 'Hitec City / Cyber Towers',
        address: 'Hitec City Commercial District, Hyderabad, Telangana',
        latitude: 17.4504,
        longitude: 78.3808,
        category: 'tech_commercial',
      },
      {
        name: 'Secunderabad Clock Tower / SD Road',
        address: 'Sarojini Devi Road, Secunderabad, Telangana',
        latitude: 17.4399,
        longitude: 78.4983,
        category: 'historic_commercial',
      },
      {
        name: 'Panaji Promenade & Fontainhas',
        address: 'Panaji City Center, Goa',
        latitude: 15.4909,
        longitude: 73.8278,
        category: 'coastal_dining',
      },
      {
        name: 'Candolim Main Road Hub',
        address: 'Candolim Market Road, Goa',
        latitude: 15.5173,
        longitude: 73.7661,
        category: 'beach_corridor',
      },
      {
        name: 'Indiranagar 100ft Road',
        address: 'Indiranagar Dining Strip, Bengaluru, Karnataka',
        latitude: 12.9719,
        longitude: 77.6412,
        category: 'urban_dining',
      },
      {
        name: 'Koramangala 5th Block',
        address: 'Koramangala Food Street, Bengaluru, Karnataka',
        latitude: 12.9352,
        longitude: 77.6245,
        category: 'cafe_hub',
      },
    ];

    // Filter hubs that are within reasonable travel distance (< 35km) of the centroid
    for (const hub of CURATED_HUBS) {
      const dist = calculateHaversineDistance(center, { latitude: hub.latitude, longitude: hub.longitude });
      if (dist < 35000) {
        candidateLocations.push(hub);
      }
    }

    // Always include the exact centroid as a candidate area if no other nearby places
    candidateLocations.push({
      name: `Central Convergence (${center.latitude.toFixed(3)}, ${center.longitude.toFixed(3)})`,
      address: `Geographic Midpoint District`,
      latitude: center.latitude,
      longitude: center.longitude,
      category: 'central_convergence',
    });

    // Deduplicate candidates (keep points at least 1,200m apart)
    const distinctAreas: typeof candidateLocations = [];
    for (const cand of candidateLocations) {
      const isTooClose = distinctAreas.some(
        (existing) =>
          calculateHaversineDistance(existing, { latitude: cand.latitude, longitude: cand.longitude }) < 1200
      );
      if (!isTooClose) {
        distinctAreas.push(cand);
      }
      if (distinctAreas.length >= 8) break;
    }

    // 3. For each candidate area, compute road routes from EVERY participant using Google Routes API
    const evaluatedAreas: FairDestinationArea[] = [];

    for (let idx = 0; idx < distinctAreas.length; idx++) {
      const area = distinctAreas[idx];
      const participantRoutes: FairDestinationArea['participantRoutes'] = [];

      for (const p of participants) {
        const route = await this.calculateRoute(
          { latitude: p.latitude, longitude: p.longitude },
          { latitude: area.latitude, longitude: area.longitude },
          travelMode
        );

        participantRoutes.push({
          userId: p.id,
          userName: p.name,
          markerColor: p.markerColor || '#D1956A',
          distanceMeters: route.distanceMeters,
          durationSeconds: route.durationSeconds,
        });
      }

      const durations = participantRoutes.map((r) => r.durationSeconds);
      const maxTravelTimeSeconds = Math.max(...durations);
      const minTravelTimeSeconds = Math.min(...durations);
      const totalTravelTimeSeconds = durations.reduce((sum, d) => sum + d, 0);
      const avgTravelTimeSeconds = Math.round(totalTravelTimeSeconds / participants.length);
      const timeSpreadSeconds = maxTravelTimeSeconds - minTravelTimeSeconds;

      evaluatedAreas.push({
        id: `area_${idx + 1}`,
        name: area.name,
        address: area.address,
        latitude: area.latitude,
        longitude: area.longitude,
        category: area.category,
        maxTravelTimeSeconds,
        totalTravelTimeSeconds,
        avgTravelTimeSeconds,
        timeSpreadSeconds,
        participantRoutes,
      });
    }

    // 4. Rank by Minimax Fairness:
    // Primary: Minimize maximum travel time among any participant (min(max(T_i)))
    // Secondary: Minimize total group travel time (min(sum(T_i)))
    evaluatedAreas.sort((a, b) => {
      if (a.maxTravelTimeSeconds !== b.maxTravelTimeSeconds) {
        return a.maxTravelTimeSeconds - b.maxTravelTimeSeconds;
      }
      return a.totalTravelTimeSeconds - b.totalTravelTimeSeconds;
    });

    return {
      center,
      candidateAreas: evaluatedAreas.slice(0, 5),
    };
  }

  /**
   * Tier 2 Discovery: Discovers specific venues within a selected Destination Area
   * Calculates individual road routes and polylines from each participant
   */
  static async discoverAreaVenues(
    areaCoordinates: GeoCoordinate,
    areaName: string,
    participants: DiscoverParticipantInput[],
    category = 'all',
    travelMode: 'DRIVE' | 'WALK' | 'BICYCLE' = 'DRIVE'
  ): Promise<FairMeetingVenue[]> {
    if (participants.length === 0) {
      throw new Error('At least one participant location is required to discover venues.');
    }

    // 1. Discover venues around the chosen area using Google Places API (New)
    let places = await this.searchNearbyPlaces(areaCoordinates, category, 2500);

    if (!places || places.length === 0) {
      // Fallback search around area coordinates
      places = this.searchResilientPlaces(areaName);
    }

    // Select top 6 candidate venues
    const candidateVenues = places.slice(0, 6);
    const evaluatedVenues: FairMeetingVenue[] = [];

    // 2. For each venue, calculate road route from every participant
    for (let i = 0; i < candidateVenues.length; i++) {
      const v = candidateVenues[i];
      const participantRoutes: FairMeetingVenue['participantRoutes'] = [];

      for (const p of participants) {
        const route = await this.calculateRoute(
          { latitude: p.latitude, longitude: p.longitude },
          { latitude: v.latitude, longitude: v.longitude },
          travelMode
        );

        participantRoutes.push({
          userId: p.id,
          userName: p.name,
          markerColor: p.markerColor || '#D1956A',
          distanceMeters: route.distanceMeters,
          durationSeconds: route.durationSeconds,
          polyline: route.encodedPolyline,
        });
      }

      const durations = participantRoutes.map((r) => r.durationSeconds);
      const maxTravelTimeSeconds = Math.max(...durations);
      const minTravelTimeSeconds = Math.min(...durations);
      const totalTravelTimeSeconds = durations.reduce((sum, d) => sum + d, 0);
      const avgTravelTimeSeconds = Math.round(totalTravelTimeSeconds / participants.length);
      const timeSpreadSeconds = maxTravelTimeSeconds - minTravelTimeSeconds;

      // Ranking score calculation (Minimax + rating + openNow)
      // Benchmark 20 minutes (1200 seconds)
      const minimaxPenalty = Math.max(0, 60 * (1 - maxTravelTimeSeconds / 1800));
      const ratingBonus = v.rating ? (v.rating / 5) * 20 : 15;
      const openBonus = v.openNow === true ? 10 : 5;
      const rankingScore = Math.round(minimaxPenalty + ratingBonus + openBonus);

      evaluatedVenues.push({
        id: `venue_${i + 1}_${v.placeId || Math.random().toString(36).substring(7)}`,
        name: v.name,
        address: v.address,
        latitude: v.latitude,
        longitude: v.longitude,
        placeId: v.placeId || `p_${i}`,
        category: v.category || category,
        primaryType: v.primaryType,
        rating: v.rating,
        userRatingCount: v.userRatingCount,
        openNow: v.openNow,
        openStatusText: v.openStatusText,
        googleMapsUri: v.googleMapsUri,
        maxTravelTimeSeconds,
        totalTravelTimeSeconds,
        avgTravelTimeSeconds,
        timeSpreadSeconds,
        rankingScore,
        participantRoutes,
      });
    }

    // Sort by Minimax fairness (lowest max travel time, then highest ranking score)
    evaluatedVenues.sort((a, b) => {
      if (a.maxTravelTimeSeconds !== b.maxTravelTimeSeconds) {
        return a.maxTravelTimeSeconds - b.maxTravelTimeSeconds;
      }
      return b.rankingScore - a.rankingScore;
    });

    return evaluatedVenues;
  }
}

