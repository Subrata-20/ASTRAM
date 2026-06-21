export interface Incident {
  id: string;
  type: string; // e.g. "Collision", "Breakdown", "Weather Hazard", "Infrastructure Failure"
  cause: string; // e.g. "Unknown", "Driver Error", "Mechanical", "Environmental"
  corridor: string; // e.g. "I-95 North", "I-95 South", "Route 66", "Beltway Inner Loop"
  zone: string; // e.g. "Alpha Sector", "Beta Sector", "Gamma Sector", "Delta Sector"
  vehicleType: string; // e.g. "Passenger Car", "Commercial Truck", "Motorcycle", "Public Transit", "Multiple"
  time: string; // hh:mm format
  address: string;
  lat: number;
  lng: number;
  burdenScore: number; // percentage (0-100)
  priority: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW';
  status: string; // e.g. "Active", "Resolved"
  officersRequired: number;
  targetZones: string;
  barricadingType: string;
  barricadingDescription?: string;
  diversionMain: string;
  diversionAlt: string;
  priorityConfidence: number;
  closureConfidence: number;
  durationConfidence: number;
  roadClosure: boolean;
  estDurationMin: number;
  reportedAt: Date;
}

export type ActiveTab = 'dashboard' | 'report' | 'results' | 'analytics';

export interface AnalyticsDataPoint {
  time: string;
  events: number;
  baseline: number;
}

export interface ResolutionDataPoint {
  cause: string;
  days: number;
}

export interface ClosureDataPoint {
  cause: string;
  prob: number;
}
