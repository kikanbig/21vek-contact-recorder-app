import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, Location, Recording } from '../types';

export class StorageService {
  private static readonly USER_KEY = 'user_data';
  private static readonly LOCATION_KEY = 'selected_location';
  private static readonly RECORDINGS_KEY = 'recordings';

  // Пользователи
  static async saveUser(user: User): Promise<void> {
    try {
      await AsyncStorage.setItem(this.USER_KEY, JSON.stringify(user));
    } catch (error) {
      console.error('Ошибка при сохранении пользователя:', error);
    }
  }

  static async getUser(): Promise<User | null> {
    try {
      const userData = await AsyncStorage.getItem(this.USER_KEY);
      return userData ? JSON.parse(userData) : null;
    } catch (error) {
      console.error('Ошибка при получении пользователя:', error);
      return null;
    }
  }

  static async removeUser(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.USER_KEY);
    } catch (error) {
      console.error('Ошибка при удалении пользователя:', error);
    }
  }

  // Локация
  static async saveSelectedLocation(location: Location): Promise<void> {
    try {
      await AsyncStorage.setItem(this.LOCATION_KEY, JSON.stringify(location));
    } catch (error) {
      console.error('Ошибка при сохранении локации:', error);
    }
  }

  static async getSelectedLocation(): Promise<Location | null> {
    try {
      const locationData = await AsyncStorage.getItem(this.LOCATION_KEY);
      return locationData ? JSON.parse(locationData) : null;
    } catch (error) {
      console.error('Ошибка при получении локации:', error);
      return null;
    }
  }

  // Записи
  static async saveRecording(recording: Recording): Promise<void> {
    try {
      const recordings = await this.getRecordings();
      const updatedRecordings = [...recordings, recording];
      await AsyncStorage.setItem(this.RECORDINGS_KEY, JSON.stringify(updatedRecordings));
    } catch (error) {
      console.error('Ошибка при сохранении записи:', error);
    }
  }

  static async getRecordings(): Promise<Recording[]> {
    try {
      const recordingsData = await AsyncStorage.getItem(this.RECORDINGS_KEY);
      return recordingsData ? JSON.parse(recordingsData) : [];
    } catch (error) {
      console.error('Ошибка при получении записей:', error);
      return [];
    }
  }

  static async removeRecording(recordingId: string): Promise<void> {
    try {
      const recordings = await this.getRecordings();
      const filteredRecordings = recordings.filter(r => r.id !== recordingId);
      await AsyncStorage.setItem(this.RECORDINGS_KEY, JSON.stringify(filteredRecordings));
    } catch (error) {
      console.error('Ошибка при удалении записи:', error);
    }
  }

  static async clearAllData(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([this.USER_KEY, this.LOCATION_KEY, this.RECORDINGS_KEY]);
    } catch (error) {
      console.error('Ошибка при очистке данных:', error);
    }
  }
} 