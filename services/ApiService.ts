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

  // Загрузить аудио файл на сервер
  async uploadAudio(recordingData: {
    uri: string;
    type: string;
    name: string;
    duration_seconds: number;
    location_id: number;
    recording_date: string;
  }): Promise<{ success: boolean; message: string; recording?: any }> {
    const formData = new FormData();
    
    // Добавляем аудио файл
    formData.append('audio', {
      uri: recordingData.uri,
      type: recordingData.type,
      name: recordingData.name,
    } as any);
    
    // Добавляем метаданные
    formData.append('duration_seconds', recordingData.duration_seconds.toString());
    formData.append('location_id', recordingData.location_id.toString());
    formData.append('recording_date', recordingData.recording_date);
    formData.append('filename', recordingData.name);

    const url = `${API_BASE_URL}/api/recordings/upload`;
    
    const headers: Record<string, string> = {};
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      console.log('📤 Отправляем аудио файл на сервер:', url);
      
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ HTTP ошибка:', response.status, errorText);
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }

      const result = await response.json();
      console.log('✅ Ответ сервера:', result);
      return result;
    } catch (error) {
      console.error('❌ Ошибка загрузки аудио:', error);
      throw error;
    }
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