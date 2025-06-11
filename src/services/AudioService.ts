import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
// import { logger } from '../utils/Logger';

// Временная замена logger на console для быстрого тестирования
const logger = {
  info: (msg: string, data?: any) => console.log('ℹ️', msg, data || ''),
  warn: (msg: string, data?: any) => console.warn('⚠️', msg, data || ''),
  error: (msg: string, data?: any) => console.error('❌', msg, data || ''),
};

export class AudioService {
  private recording: Audio.Recording | null = null;
  private isRecording = false;

  async requestPermissions(): Promise<boolean> {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        logger.error('[AudioService] Разрешение на запись аудио не предоставлено');
        return false;
      }
      logger.info('[AudioService] Разрешения на запись получены');
      return true;
    } catch (error) {
      logger.error('[AudioService] Ошибка при запросе разрешений', error);
      return false;
    }
  }

  async startRecording(): Promise<string | null> {
    try {
      if (this.isRecording) {
        logger.warn('AudioService', 'Запись уже идет');
        return null;
      }

      // Запрашиваем разрешения если их нет
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        throw new Error('Нет разрешения на запись аудио');
      }

      // Настраиваем аудио режим для записи
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        playThroughEarpieceAndroid: false,
      });

      // Создаем новую запись
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      this.recording = recording;
      this.isRecording = true;
      
      logger.info('AudioService', 'Запись началась');
      return 'recording'; // Возвращаем placeholder, настоящий URI получим при остановке
    } catch (error) {
      logger.error('AudioService', 'Ошибка при начале записи', error);
      return null;
    }
  }

  async stopRecording(): Promise<string | null> {
    try {
      if (!this.isRecording || !this.recording) {
        logger.warn('AudioService', 'Запись не была начата');
        return null;
      }

      // Останавливаем запись
      await this.recording.stopAndUnloadAsync();
      
      // Получаем URI записанного файла
      const uri = this.recording.getURI();
      
      this.isRecording = false;
      this.recording = null;

      logger.info('AudioService', `Запись остановлена: ${uri}`);
      return uri;
    } catch (error) {
      logger.error('AudioService', 'Ошибка при остановке записи', error);
      return null;
    }
  }

  async getRecordingDuration(uri: string): Promise<number> {
    try {
      if (!uri || uri === 'recording') {
        return 0;
      }

      // Создаем объект Audio.Sound для получения метаданных
      const { sound } = await Audio.Sound.createAsync({ uri });
      const status = await sound.getStatusAsync();
      
      // Освобождаем ресурсы
      await sound.unloadAsync();
      
      if (status.isLoaded && status.durationMillis) {
        logger.info('AudioService', `Длительность записи: ${status.durationMillis}ms`);
        return status.durationMillis;
      }
      
      return 0;
    } catch (error) {
      logger.error('AudioService', 'Ошибка при получении длительности записи', error);
      // Возвращаем приблизительную длительность по размеру файла
      try {
        const fileInfo = await FileSystem.getInfoAsync(uri);
        if (fileInfo.exists && fileInfo.size) {
          // Примерная оценка: 1 секунда ≈ 16KB для m4a
          return Math.max(1000, (fileInfo.size / 16000) * 1000);
        }
      } catch (e) {
        logger.error('AudioService', 'Не удалось получить размер файла', e);
      }
      return 1000; // Минимум 1 секунда
    }
  }

  async saveRecordingToDocuments(uri: string, filename: string): Promise<string> {
    try {
      const documentsDir = FileSystem.documentDirectory;
      const recordingsDir = `${documentsDir}recordings/`;
      
      // Создаем папку для записей если её нет
      const dirInfo = await FileSystem.getInfoAsync(recordingsDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(recordingsDir, { intermediates: true });
      }
      
      const finalPath = `${recordingsDir}${filename}`;
      
      // Копируем файл в постоянное место хранения
      await FileSystem.copyAsync({
        from: uri,
        to: finalPath,
      });

      logger.info('AudioService', `Файл сохранен: ${finalPath}`);
      return finalPath;
    } catch (error) {
      logger.error('AudioService', 'Ошибка при сохранении файла', error);
      return uri;
    }
  }

  async playRecording(uri: string): Promise<void> {
    try {
      logger.info('AudioService', `Воспроизведение записи: ${uri}`);
      
      // Настраиваем аудио режим для воспроизведения
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        playThroughEarpieceAndroid: false,
      });

      const { sound } = await Audio.Sound.createAsync({ uri });
      await sound.playAsync();
      
      // Автоматически освобождаем ресурсы после воспроизведения
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync();
        }
      });
      
      logger.info('AudioService', 'Воспроизведение началось');
    } catch (error) {
      logger.error('AudioService', 'Ошибка при воспроизведении', error);
      throw error;
    }
  }

  async uploadRecording(
    uri: string, 
    locationId: number, 
    durationSeconds: number
  ): Promise<{ success: boolean; message: string }> {
    try {
      logger.info('AudioService', `🚀 НАЧАЛО ЗАГРУЗКИ С ОЧИЩЕННЫМ КЭШЕМ: ${uri}`);
      
      // Генерируем уникальное имя файла с временной меткой
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(2, 8);
      const filename = `recording_${timestamp}_${randomId}.m4a`;
      
      logger.info('AudioService', `📁 Имя файла: ${filename}`);
      logger.info('AudioService', `📍 Локация: ${locationId}, ⏱️ Длительность: ${durationSeconds}s`);

      // 🔑 КЛЮЧЕВОЕ РЕШЕНИЕ: Специальные заголовки для предотвращения GraphQL интерпретации + очистка кэша
      const cacheBuster = Date.now().toString();
      const response = await FileSystem.uploadAsync(
        `https://contact-recorder-backend-production.up.railway.app/api/recordings/upload?cb=${cacheBuster}&ts=${timestamp}`,
        uri,
        {
          fieldName: 'audio',
          httpMethod: 'POST',
          uploadType: FileSystem.FileSystemUploadType.MULTIPART,
          parameters: {
            duration_seconds: durationSeconds.toString(),
            location_id: locationId.toString(),
            recording_date: new Date().toISOString(),
            filename: filename,
            cache_buster: cacheBuster,
          },
          headers: {
            'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInVzZXJuYW1lIjoiYWRtaW4iLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3NDk2NTc5MDQsImV4cCI6MTc1MDI2MjcwNH0.VR6-NmjphUiJadGUaHTryiWQK8xD7EM2asyJSP2_cMg',
            'Accept': 'application/json',
            'User-Agent': 'ContactRecorder-Mobile/2.0.0',
            
            // 🔥 ПРИНУДИТЕЛЬНАЯ ОЧИСТКА КЭША
            'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
            'Pragma': 'no-cache',
            'Expires': '0',
            'If-Modified-Since': '0',
            'If-None-Match': '',
            
            // 🛡️ ЗАЩИТА ОТ GRAPHQL ИНТЕРПРЕТАЦИИ
            'X-Upload-Type': 'audio-file-multipart',
            'X-Content-Type': 'multipart/form-data',
            'X-API-Version': '1.0',
            'X-Force-Upload': 'true',
            'X-Bypass-GraphQL': 'true',
            'X-Apollo-Operation-Name': '', // Пустое значение для обхода
            'X-Request-ID': `upload_${timestamp}_${randomId}`,
          },
        }
      );

      logger.info('AudioService', `📊 Статус ответа: ${response.status}`);
      logger.info('AudioService', `📝 Тело ответа: ${response.body}`);

      if (response.status === 200 || response.status === 201) {
        try {
          const result = JSON.parse(response.body);
          logger.info('AudioService', '✅ Загрузка успешна!', result);
          return { success: true, message: 'Запись успешно загружена на сервер' };
        } catch (parseError) {
          logger.warn('AudioService', '✅ Загрузка успешна (ответ не JSON)');
          return { success: true, message: 'Запись успешно загружена на сервер' };
        }
      } else {
        logger.error('AudioService', `❌ Ошибка сервера: ${response.status}`, response.body);
        return { 
          success: false, 
          message: `Ошибка сервера: ${response.status}. ${response.body || 'Неизвестная ошибка'}` 
        };
      }

    } catch (error) {
      logger.error('AudioService', '💥 КРИТИЧЕСКАЯ ОШИБКА ЗАГРУЗКИ', error);
      
      let errorMessage = 'Неизвестная ошибка при загрузке';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      return { 
        success: false, 
        message: `Проблема с загрузкой: ${errorMessage}. Запись сохранена локально.` 
      };
    }
  }

  getIsRecording(): boolean {
    return this.isRecording;
  }
} 