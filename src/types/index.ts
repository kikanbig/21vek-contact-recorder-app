export interface User {
  id: string;
  username: string;
  password: string;
  isLoggedIn: boolean;
}

export interface Location {
  id: string;
  name: string;
  address: string;
}

export interface Recording {
  id: string;
  userId: string;
  locationId: string;
  startTime: Date;
  endTime?: Date;
  audioFilePath: string;
  duration: number;
  serverId?: number;
  synced?: boolean;
}

export interface AppState {
  user: User | null;
  selectedLocation: Location | null;
  isRecording: boolean;
  recordings: Recording[];
}

export const SAMPLE_LOCATIONS: Location[] = [
  { id: '1', name: 'Магазин Центр', address: 'ул. Ленина, 1' },
  { id: '2', name: 'Магазин Север', address: 'ул. Мира, 15' },
  { id: '3', name: 'Магазин Юг', address: 'ул. Советская, 22' },
  { id: '4', name: 'Магазин Восток', address: 'ул. Гагарина, 8' },
  { id: '5', name: 'Магазин Запад', address: 'ул. Пушкина, 33' },
]; 