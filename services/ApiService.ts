import { logger } from '../src/utils/Logger';
import * as FileSystem from 'expo-file-system';

// API Service для работы с Backend
const API_BASE_URL = 'https://contact-recorder-backend-production.up.railway.app';
// const API_BASE_URL = 'http://localhost:3000'; // Для локальной разработки

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
}

export interface User {
  id: number;
  username: string;
  fullName: string;
  role: 'seller' | 'admin';
}

export interface LoginResponse {
  success: boolean;
  message: string;
  user: User;
  token: string;
}

export interface Location {
  id: number;
  name: string;
  address: string;
  city: string;
  region: string;
  createdAt: string;
}

export interface Recording {
  id: string;
  fileName: string;
  duration: number;
  locationId: string;
  fileSize?: number;
  recordingTime: string;
  uploadedAt?: string;
  status: 'local' | 'uploaded' | 'syncing';
}

export interface RecordingStats {
  totalRecordings: number;
  totalDuration: number;
  averageDuration: number;
  recordingsToday: number;
}

class ApiService {
  private token: string | null = null;

  setToken(token: string) {
    this.token = token;
  }

  clearToken() {
    this.token = null;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API Request failed:', error);
      throw error;
    }
  }

  // Авторизация
  async login(username: string, password: string): Promise<LoginResponse> {
    const response = await this.request<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });

    if (response.success && response.token) {
      this.setToken(response.token);
    }

    return response;
  }

  // Получить информацию о текущем пользователе
  async getCurrentUser(): Promise<{ success: boolean; user: User }> {
    return this.request<{ success: boolean; user: User }>('/api/auth/me');
  }

  // Выход из системы
  async logout(): Promise<void> {
    this.clearToken();
    console.log('🚪 Выход из системы - токен очищен');
  }

  // Получить список локаций
  async getLocations(): Promise<{ success: boolean; locations: Location[] }> {
    return this.request<{ success: boolean; locations: Location[] }>('/api/locations');
  }

  // Получить конкретную локацию
  async getLocation(id: number): Promise<{ success: boolean; location: Location }> {
    return this.request<{ success: boolean; location: Location }>(`/api/locations/${id}`);
  }

  // Проверить статус API
  async getApiStatus(): Promise<any> {
    return this.request<any>('/');
  }

  // Проверить здоровье сервера
  async getHealthStatus(): Promise<any> {
    return this.request<any>('/health');
  }

  // === ЗАПИСИ ===

  // Загрузить аудио файл на сервер с повторными попытками
  async uploadAudio(recordingData: {
    uri: string;
    type: string;
    name: string;
    duration_seconds: number;
    location_id: number;
    recording_date: string;
  }): Promise<{ success: boolean; message: string; recording?: any }> {
    
    logger.info('🚀 Начинаем загрузку аудио файла', recordingData);
    
    // Проверяем наличие токена авторизации
    if (!this.token) {
      logger.warn('❌ Отсутствует токен авторизации, пытаемся авторизоваться...');
      try {
        const authResponse = await this.login('admin', 'admin123');
        if (!authResponse.success) {
          throw new Error('Не удалось авторизоваться для загрузки файла');
        }
        logger.info('✅ Успешная авторизация для загрузки файла');
      } catch (authError) {
        logger.error('❌ Ошибка авторизации', {
          message: (authError as Error).message,
          stack: (authError as Error).stack,
          name: (authError as Error).name
        });
        return {
          success: false,
          message: 'Ошибка авторизации: ' + (authError as Error).message
        };
      }
    } else {
      logger.info('✅ Токен авторизации присутствует');
    }
    
    const maxRetries = 3;
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.info(`📤 Попытка загрузки ${attempt}/${maxRetries}...`);
        
        // Проверяем, что файл существует
        logger.info('🔍 Проверяем аудио файл', {
          uri: recordingData.uri,
          type: recordingData.type,
          name: recordingData.name,
          exists: recordingData.uri.startsWith('file://'),
          fileExtension: recordingData.name.split('.').pop()
        });
        
        // Проверяем размер файла если возможно
        try {
          // Простая проверка что файл доступен
          const uriCheck = recordingData.uri;
          if (!uriCheck || !uriCheck.startsWith('file://')) {
            throw new Error('Некорректный URI файла: ' + uriCheck);
          }
          logger.info('✅ URI файла проверен');
        } catch (uriError) {
          logger.error('❌ Ошибка проверки URI файла', { error: (uriError as Error).message });
          throw uriError;
        }

        const url = `${API_BASE_URL}/api/recordings/upload`;

        logger.info('📤 Отправка данных', {
          url,
          fileName: recordingData.name,
          duration: recordingData.duration_seconds,
          locationId: recordingData.location_id,
          hasToken: !!this.token,
          tokenPrefix: this.token?.substring(0, 20) + '...'
        });
        
        // Проверяем сетевое подключение
        const healthCheck = await fetch(`${API_BASE_URL}/health`, {
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        });
        
        if (!healthCheck.ok) {
          throw new Error(`Server health check failed: ${healthCheck.status}`);
        }
        
        logger.info('✅ Сервер доступен, отправляем файл...');

        // Дополнительная проверка данных перед отправкой
        logger.info('🔍 Проверяем данные перед отправкой', {
          hasUri: !!recordingData.uri,
          hasType: !!recordingData.type,
          hasName: !!recordingData.name,
          hasDuration: !!recordingData.duration_seconds,
          hasLocationId: !!recordingData.location_id,
          hasDate: !!recordingData.recording_date,
          fileExtension: recordingData.name.split('.').pop()
        });

        // Используем expo-file-system.uploadAsync для обхода проблемы с GraphQL multipart
        logger.info('📤 Отправляем файл через expo-file-system.uploadAsync...');
        
        const uploadOptions = {
          headers: {
            'Authorization': this.token ? `Bearer ${this.token}` : '',
          },
          httpMethod: 'POST' as const,
          uploadType: FileSystem.FileSystemUploadType.MULTIPART,
          fieldName: 'audio',
          mimeType: recordingData.type,
          parameters: {
            duration_seconds: recordingData.duration_seconds.toString(),
            location_id: recordingData.location_id.toString(),
            recording_date: recordingData.recording_date,
            filename: recordingData.name,
          },
        };

        logger.info('🔍 Параметры загрузки expo-file-system', {
          uri: recordingData.uri,
          url: url,
          fieldName: uploadOptions.fieldName,
          mimeType: uploadOptions.mimeType,
          parameters: uploadOptions.parameters,
          hasToken: !!this.token
        });

        const uploadResult = await FileSystem.uploadAsync(recordingData.uri, url, uploadOptions);
        
        logger.info('📥 Ответ expo-file-system.uploadAsync', {
          status: uploadResult.status,
          body: uploadResult.body?.substring(0, 500),
          headers: uploadResult.headers
        });

        if (uploadResult.status >= 200 && uploadResult.status < 300) {
          try {
            const result = JSON.parse(uploadResult.body);
            logger.info('✅ Успешный ответ сервера через expo-file-system', result);
            return result;
          } catch (parseError) {
            logger.error('❌ Ошибка парсинга ответа expo-file-system', {
              error: (parseError as Error).message,
              body: uploadResult.body?.substring(0, 500)
            });
            throw new Error('Ошибка парсинга ответа сервера');
          }
        } else {
          logger.error('❌ HTTP ошибка в expo-file-system', {
            status: uploadResult.status,
            body: uploadResult.body?.substring(0, 500)
          });
          throw new Error(`HTTP ${uploadResult.status}: ${uploadResult.body}`);
        }
        
      } catch (error) {
        lastError = error;
        logger.error(`❌ Ошибка попытки ${attempt}`, {
          message: (error as Error).message,
          name: (error as Error).name,
          stack: (error as Error).stack,
          cause: (error as any).cause,
          code: (error as any).code,
          type: typeof error,
          stringError: String(error)
        });
        
        if (attempt < maxRetries) {
          const delay = attempt * 2000; // 2, 4 секунды
          logger.info(`⏳ Ожидание ${delay}ms перед следующей попыткой...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    logger.error('❌ Все попытки загрузки неудачны', {
      message: (lastError as Error).message,
      name: (lastError as Error).name,
      stack: (lastError as Error).stack,
      cause: (lastError as any).cause,
      code: (lastError as any).code,
      type: typeof lastError,
      stringError: String(lastError)
    });
    throw lastError;
  }

  // Загрузить метаданные записи на сервер
  async uploadRecording(recordingData: {
    fileName: string;
    duration: number;
    locationId: string;
    fileSize?: number;
    recordingTime: string;
  }): Promise<{ success: boolean; message: string; recording?: any }> {
    return this.request<{ success: boolean; message: string; recording?: any }>('/api/recordings/upload', {
      method: 'POST',
      body: JSON.stringify(recordingData),
    });
  }

  // Получить список записей
  async getRecordings(): Promise<{ success: boolean; recordings: Recording[]; total: number }> {
    return this.request<{ success: boolean; recordings: Recording[]; total: number }>('/api/recordings');
  }

  // Получить статистику записей
  async getRecordingStats(): Promise<{ success: boolean; stats: RecordingStats }> {
    return this.request<{ success: boolean; stats: RecordingStats }>('/api/recordings/stats');
  }

  // Удалить запись
  async deleteRecording(id: string): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>(`/api/recordings/${id}`, {
      method: 'DELETE',
    });
  }

  // Транскрибировать запись
  async transcribeRecording(id: string, audioData: string): Promise<{ 
    success: boolean; 
    message: string; 
    transcription?: string;
    transcribedAt?: string;
  }> {
    return this.request<{ 
      success: boolean; 
      message: string; 
      transcription?: string;
      transcribedAt?: string;
    }>(`/api/recordings/${id}/transcribe`, {
      method: 'POST',
      body: JSON.stringify({ audioData }),
    });
  }

  // Получить транскрипцию записи
  async getTranscription(id: string): Promise<{ 
    success: boolean; 
    transcription?: string;
    transcribedAt?: string;
    recording?: any;
  }> {
    return this.request<{ 
      success: boolean; 
      transcription?: string;
      transcribedAt?: string;
      recording?: any;
    }>(`/api/recordings/${id}/transcription`);
  }
}

export const apiService = new ApiService(); 