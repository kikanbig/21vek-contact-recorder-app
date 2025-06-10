import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Конфигурация API - будет обновлена после деплоя
const API_BASE_URL = __DEV__ ? 'http://10.0.2.2:3000' : 'https://your-railway-app.railway.app';

interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

interface User {
  id: number;
  username: string;
  full_name: string;
  role: string;
  email?: string;
  phone?: string;
}

interface Location {
  id: number;
  name: string;
  address?: string;
  city?: string;
  description?: string;
  is_active: boolean;
}

interface Recording {
  id: number;
  filename: string;
  duration_seconds?: number;
  file_size: number;
  location_name?: string;
  recording_date: string;
  uploaded_at: string;
  status: string;
  has_transcription: boolean;
  transcribed_at?: string;
}

interface AudioUploadData {
  uri: string;
  type: string;
  name: string;
  duration_seconds?: number;
  location_id?: number;
  recording_date?: string;
}

class ApiService {
  private authToken: string | null = null;

  constructor() {
    this.loadAuthToken();
  }

  // Инициализация - загружаем токен из хранилища
  async loadAuthToken(): Promise<void> {
    try {
      this.authToken = await AsyncStorage.getItem('authToken');
    } catch (error) {
      console.error('Ошибка загрузки токена:', error);
    }
  }

  // Установка токена авторизации
  setAuthToken(token: string): void {
    this.authToken = token;
    AsyncStorage.setItem('authToken', token);
  }

  // Очистка токена
  clearAuthToken(): void {
    this.authToken = null;
    AsyncStorage.removeItem('authToken');
  }

  // Базовый метод для API запросов
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers as Record<string, string>,
    };

    if (this.authToken) {
      headers.Authorization = `Bearer ${this.authToken}`;
    }

    try {
      console.log(`🌐 API запрос: ${options.method || 'GET'} ${url}`);
      
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `HTTP error! status: ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error(`❌ API ошибка: ${endpoint}`, error);
      throw error;
    }
  }

  // Авторизация
  async login(username: string, password: string): Promise<{ success: boolean; user?: User; token?: string; message?: string }> {
    try {
      const response = await this.makeRequest<any>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });

      if (response.success && response.token) {
        this.setAuthToken(response.token);
      }

      return response;
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Ошибка авторизации'
      };
    }
  }

  // Выход
  async logout(): Promise<void> {
    this.clearAuthToken();
  }

  // Получение профиля пользователя
  async getProfile(): Promise<{ success: boolean; user?: User; message?: string }> {
    try {
      const response = await this.makeRequest<any>('/api/auth/me');
      return response;
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Ошибка получения профиля'
      };
    }
  }

  // Получение списка локаций
  async getLocations(): Promise<{ success: boolean; locations?: Location[]; message?: string }> {
    try {
      const response = await this.makeRequest<any>('/api/locations');
      return response;
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Ошибка получения локаций'
      };
    }
  }

  // Загрузка аудио файла
  async uploadAudio(audioData: AudioUploadData): Promise<{ success: boolean; recording?: any; message?: string }> {
    try {
      const formData = new FormData();
      
      // Подготавливаем файл
      const fileExtension = audioData.name.split('.').pop() || 'm4a';
      const fileName = `recording_${Date.now()}.${fileExtension}`;
      
      formData.append('audio', {
        uri: audioData.uri,
        type: audioData.type || 'audio/m4a',
        name: fileName,
      } as any);

      // Добавляем метаданные
      if (audioData.duration_seconds) {
        formData.append('duration_seconds', audioData.duration_seconds.toString());
      }
      
      if (audioData.location_id) {
        formData.append('location_id', audioData.location_id.toString());
      }
      
      if (audioData.recording_date) {
        formData.append('recording_date', audioData.recording_date);
      }

      // Добавляем дополнительные метаданные
      const metadata = {
        app_version: '3.0.0',
        platform: Platform.OS,
        uploaded_from: 'mobile_app'
      };
      formData.append('metadata', JSON.stringify(metadata));

      const url = `${API_BASE_URL}/api/recordings/upload`;
      
      const headers: Record<string, string> = {
        'Content-Type': 'multipart/form-data',
      };

      if (this.authToken) {
        headers.Authorization = `Bearer ${this.authToken}`;
      }

      console.log('📤 Загружаем аудио файл:', fileName);
      console.log('📊 Размер:', audioData.name);
      console.log('📍 Локация:', audioData.location_id);

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `HTTP error! status: ${response.status}`);
      }

      console.log('✅ Аудио файл загружен успешно');
      return data;

    } catch (error) {
      console.error('❌ Ошибка загрузки аудио:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Ошибка загрузки аудио файла'
      };
    }
  }

  // Получение списка записей пользователя
  async getRecordings(limit: number = 50, offset: number = 0): Promise<{ success: boolean; recordings?: Recording[]; message?: string }> {
    try {
      const response = await this.makeRequest<any>(`/api/recordings?limit=${limit}&offset=${offset}`);
      return response;
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Ошибка получения записей'
      };
    }
  }

  // Получение статистики записей
  async getStats(): Promise<{ success: boolean; stats?: any; message?: string }> {
    try {
      const response = await this.makeRequest<any>('/api/recordings/stats');
      return response;
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Ошибка получения статистики'
      };
    }
  }

  // Получение конкретной записи
  async getRecording(id: number): Promise<{ success: boolean; recording?: any; message?: string }> {
    try {
      const response = await this.makeRequest<any>(`/api/recordings/${id}`);
      return response;
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Ошибка получения записи'
      };
    }
  }

  // Проверка состояния сервера
  async checkServerHealth(): Promise<{ success: boolean; status?: string; message?: string }> {
    try {
      const response = await this.makeRequest<any>('/health');
      return {
        success: true,
        status: response.status,
        message: 'Сервер работает'
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Сервер недоступен'
      };
    }
  }
}

// Экспортируем единственный экземпляр
export const apiService = new ApiService();
export default apiService; 