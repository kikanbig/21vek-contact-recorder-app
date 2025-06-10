import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';

export class AudioService {
  private recording: Audio.Recording | null = null;
  private isRecording = false;

  async requestPermissions(): Promise<boolean> {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        console.error('Разрешение на запись аудио не предоставлено');
        return false;
      }
      return true;
    } catch (error) {
      console.error('Ошибка при запросе разрешений:', error);
      return false;
    }
  }

  async startRecording(): Promise<string | null> {
    try {
      if (this.isRecording) {
        console.log('Запись уже идет');
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
      
      console.log('✅ Запись началась');
      return 'recording'; // Возвращаем placeholder, настоящий URI получим при остановке
    } catch (error) {
      console.error('❌ Ошибка при начале записи:', error);
      return null;
    }
  }

  async stopRecording(): Promise<string | null> {
    try {
      if (!this.isRecording || !this.recording) {
        console.log('Запись не была начата');
        return null;
      }

      // Останавливаем запись
      await this.recording.stopAndUnloadAsync();
      
      // Получаем URI записанного файла
      const uri = this.recording.getURI();
      
      this.isRecording = false;
      this.recording = null;

      console.log('✅ Запись остановлена, файл сохранен в:', uri);
      return uri;
    } catch (error) {
      console.error('❌ Ошибка при остановке записи:', error);
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
        return status.durationMillis;
      }
      
      return 0;
    } catch (error) {
      console.error('❌ Ошибка при получении длительности записи:', error);
      // Возвращаем приблизительную длительность по размеру файла
      try {
        const fileInfo = await FileSystem.getInfoAsync(uri);
        if (fileInfo.exists && fileInfo.size) {
          // Примерная оценка: 1 секунда ≈ 16KB для m4a
          return Math.max(1000, (fileInfo.size / 16000) * 1000);
        }
      } catch (e) {
        console.error('Не удалось получить размер файла:', e);
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

      console.log('✅ Файл сохранен в документы:', finalPath);
      return finalPath;
    } catch (error) {
      console.error('❌ Ошибка при сохранении файла:', error);
      return uri;
    }
  }

  async playRecording(uri: string): Promise<void> {
    try {
      console.log('🔊 Воспроизведение записи:', uri);
      
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
      
      console.log('✅ Воспроизведение началось');
    } catch (error) {
      console.error('❌ Ошибка при воспроизведении:', error);
      throw error;
    }
  }

  getIsRecording(): boolean {
    return this.isRecording;
  }
} 