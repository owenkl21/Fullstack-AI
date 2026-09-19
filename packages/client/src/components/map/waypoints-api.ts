import axios from 'axios';

/* Private marks. The server scopes every one of these to the signed-in angler. */

export type WaypointKind = 'MARK' | 'ACCESS' | 'HAZARD' | 'PARKING' | 'BAIT';

export type Waypoint = {
   id: string;
   name: string;
   note: string | null;
   kind: WaypointKind;
   latitude: number;
   longitude: number;
   createdAt: string;
};

export const WAYPOINT_KINDS: { value: WaypointKind; label: string }[] = [
   { value: 'MARK', label: 'A mark' },
   { value: 'ACCESS', label: 'Way down' },
   { value: 'HAZARD', label: 'Hazard' },
   { value: 'PARKING', label: 'Parking' },
   { value: 'BAIT', label: 'Bait' },
];

export async function fetchWaypoints(signal?: AbortSignal) {
   const { data } = await axios.get<{ waypoints: Waypoint[] }>(
      '/api/waypoints',
      { signal }
   );
   return data.waypoints ?? [];
}

export async function createWaypoint(input: {
   name: string;
   note?: string | null;
   kind: WaypointKind;
   latitude: number;
   longitude: number;
}) {
   const { data } = await axios.post<{ waypoint: Waypoint }>(
      '/api/waypoints',
      input
   );
   return data.waypoint;
}

export const deleteWaypoint = (id: string) =>
   axios.delete(`/api/waypoints/${id}`);
