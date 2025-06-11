import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { User, Location, Recording } from '../types';
import { AudioService } from '../services/AudioService';
import { StorageService } from '../services/StorageService';
import { apiService } from '../services/ApiService';
import { logger } from '../utils/Logger';

interface RecordingScreenProps {
  user: User;
  location: Location;
  onLogout: () => void;
  onShowRecordings: () => void;
  onShowLogs?: () => void;
}

export default function RecordingScreen({ user, location, onLogout, onShowRecordings, onShowLogs }: RecordingScreenProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioService] = useState(new AudioService());
  const [recordingStartTime, setRecordingStartTime] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [lastRecordingUri, setLastRecordingUri] = useState<string | null>(null);

  useEffect(() => {
    initializeAudio();
  }, []);

  // Обновляем время каждую секунду во время записи
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording) {
      interval = setInterval(() => {
        setCurrentTime(new Date());
      }, 1000);
    }
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isRecording]);

  const initializeAudio = async () => {
    const hasPermission = await audioService.requestPermissions();
    if (!hasPermission) {
      Alert.alert(
        'Разрешения',
        'Для работы приложения необходимо разрешение на запись аудио',
        [{ text: 'OK' }]
      );
    }
  };

  const handleContactButton = async () => {
    if (isLoading || isUploading) return;

    setIsLoading(true);

    try {
      if (!isRecording) {
        await startRecording();
      } else {
        await stopRecording();
      }
    } catch (error) {
      console.error('Ошибка при управлении записью:', error);
      Alert.alert('Ошибка', 'Произошла ошибка при работе с записью');
    } finally {
      setIsLoading(false);
    }
  };

  const startRecording = async () => {
    try {
      const uri = await audioService.startRecording();
      if (uri) {
        setIsRecording(true);
        setRecordingStartTime(new Date());
        logger.info('✅ Запись началась');
      } else {
        Alert.alert('Ошибка', 'Не удалось начать запись');
      }
    } catch (error) {
      console.error('❌ Ошибка при начале записи:', error);
      Alert.alert('Ошибка', 'Не удалось начать запись');
    }
  };

  const stopRecording = async () => {
    try {
      const uri = await audioService.stopRecording();
      if (uri && recordingStartTime) {
        const endTime = new Date();
        const duration = await audioService.getRecordingDuration(uri);
        const durationSeconds = Math.round(duration / 1000);
        
        // Создаем уникальное имя файла
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `recording_${user.username}_${timestamp}.m4a`;
        
        logger.info('📁 Запись завершена:', {
          filename,
          duration: durationSeconds,
          location: location.name,
          uri
        });

        setIsRecording(false);
        setRecordingStartTime(null);
        setLastRecordingUri(uri); // Сохраняем URI для тестирования воспроизведения
        setIsUploading(true);

        // Автоматически загружаем на сервер
        try {
          logger.info('🚀 Начинаем загрузку аудио файла на сервер...');
          logger.info('📤 Данные для загрузки', {
            uri: uri,
            type: 'audio/m4a',
            name: filename,
            duration_seconds: durationSeconds,
            location_id: parseInt(location.id),
            recording_date: recordingStartTime.toISOString(),
          });
          
          const uploadResult = await audioService.uploadRecording(uri, parseInt(location.id), durationSeconds);
          
          if (uploadResult.success) {
            logger.info('✅ Аудио файл успешно загружен на сервер');
            
            // Сохраняем запись в локальное хранилище для резервной копии
            const recording: Recording = {
              id: Date.now().toString(),
              userId: user.id,
              locationId: location.id,
              startTime: recordingStartTime,
              endTime,
              audioFilePath: uri,
              duration,
              serverId: Date.now(), // Используем timestamp как ID
              synced: true,
            };

            await StorageService.saveRecording(recording);

            Alert.alert(
              '✅ Запись загружена',
              `Длительность: ${durationSeconds} сек.\nЛокация: ${location.name}\n\n✅ Успешно загружено на сервер\n💾 Резервная копия сохранена локально`,
              [{ text: 'OK' }]
            );

          } else {
            throw new Error(uploadResult.message || 'Ошибка загрузки на сервер');
          }
          
        } catch (serverError) {
          logger.error('❌ Ошибка загрузки на сервер', {
            message: (serverError as Error).message,
            name: (serverError as Error).name,
            stack: (serverError as Error).stack,
            cause: (serverError as any).cause,
            code: (serverError as any).code,
            type: typeof serverError,
            stringError: String(serverError)
          });
          
          // Сохраняем локально если не удалось загрузить на сервер
          const savedPath = await audioService.saveRecordingToDocuments(uri, filename);
          
          const recording: Recording = {
            id: Date.now().toString(),
            userId: user.id,
            locationId: location.id,
            startTime: recordingStartTime,
            endTime,
            audioFilePath: savedPath,
            duration,
            synced: false,
          };

          await StorageService.saveRecording(recording);

          Alert.alert(
            '⚠️ Проблема с загрузкой',
            `Длительность: ${durationSeconds} сек.\nЛокация: ${location.name}\n\n❌ Не удалось загрузить на сервер\n💾 Сохранено локально\n\nЗапись будет загружена автоматически при восстановлении соединения.`,
            [{ text: 'OK' }]
          );
        }

        setIsUploading(false);

      } else {
        Alert.alert('Ошибка', 'Не удалось сохранить запись');
      }
    } catch (error) {
      console.error('❌ Ошибка при остановке записи:', error);
      Alert.alert('Ошибка', 'Не удалось сохранить запись');
      setIsUploading(false);
    }
  };

  const testPlayback = async () => {
    if (!lastRecordingUri) {
      Alert.alert('Ошибка', 'Нет записи для воспроизведения');
      return;
    }

    try {
      logger.info('🔊 Тестируем воспроизведение:', lastRecordingUri);
      await audioService.playRecording(lastRecordingUri);
      Alert.alert('✅ Воспроизведение началось', 'Проверьте звук в наушниках или динамике');
    } catch (error) {
      console.error('❌ Ошибка воспроизведения:', error);
      Alert.alert('❌ Ошибка воспроизведения', 'Не удалось воспроизвести запись');
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Выход',
      'Вы уверены, что хотите выйти?',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Выйти',
          style: 'destructive',
          onPress: async () => {
            if (isRecording) {
              await audioService.stopRecording();
              setIsRecording(false);
              setRecordingStartTime(null);
            }
            await apiService.logout();
            await StorageService.removeUser();
            onLogout();
          },
        },
      ]
    );
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getRecordingDuration = () => {
    if (!recordingStartTime) return '00:00';
    const diffMs = currentTime.getTime() - recordingStartTime.getTime();
    const minutes = Math.floor(diffMs / 60000);
    const seconds = Math.floor((diffMs % 60000) / 1000);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const getButtonState = () => {
    if (isUploading) return 'uploading';
    if (isLoading) return 'loading';
    if (isRecording) return 'recording';
    return 'idle';
  };

  const getButtonText = () => {
    const state = getButtonState();
    switch (state) {
      case 'uploading':
        return 'ЗАГРУЗКА\nНА СЕРВЕР';
      case 'loading':
        return 'ОБРАБОТКА';
      case 'recording':
        return 'ЗАВЕРШИТЬ\nКОНТАКТ';
      default:
        return 'КОНТАКТ';
    }
  };

  const getInstructionText = () => {
    if (isUploading) {
      return 'Загружаем запись на сервер...\nПожалуйста, подождите';
    }
    if (isRecording) {
      return 'Нажмите кнопку еще раз для\nзавершения записи разговора';
    }
    return 'Нажмите кнопку "КОНТАКТ" для\nначала записи разговора с клиентом';
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>Продавец: {user.username}</Text>
          <Text style={styles.locationName}>Локация: {location.name}</Text>
          <Text style={styles.locationAddress}>{location.address}</Text>
        </View>
        <View style={styles.headerButtons}>
          {lastRecordingUri && (
            <TouchableOpacity style={styles.playButton} onPress={testPlayback}>
              <Text style={styles.playButtonText}>🔊 Тест</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.recordingsButton} onPress={() => onShowRecordings()}>
            <Text style={styles.recordingsButtonText}>Записи</Text>
          </TouchableOpacity>
          {onShowLogs && (
            <TouchableOpacity style={styles.logsButton} onPress={() => onShowLogs()}>
              <Text style={styles.logsButtonText}>Логи</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutButtonText}>Выйти</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.recordingArea}>
          {isRecording && (
            <View style={styles.recordingIndicator}>
              <View style={styles.recordingDot} />
              <Text style={styles.recordingText}>ЗАПИСЬ</Text>
              <Text style={styles.recordingTime}>{getRecordingDuration()}</Text>
              <Text style={styles.recordingStarted}>
                Начата в {recordingStartTime ? formatTime(recordingStartTime) : ''}
              </Text>
            </View>
          )}

          {isUploading && (
            <View style={styles.uploadingIndicator}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.uploadingText}>ЗАГРУЗКА НА СЕРВЕР</Text>
              <Text style={styles.uploadingSubtext}>
                Запись автоматически загружается...
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.contactButton,
              isRecording && styles.contactButtonRecording,
              (isLoading || isUploading) && styles.contactButtonLoading,
            ]}
            onPress={handleContactButton}
            disabled={isLoading || isUploading}
          >
            {(isLoading || isUploading) ? (
              <ActivityIndicator size="large" color="white" />
            ) : (
              <Text style={styles.contactButtonText}>
                {getButtonText()}
              </Text>
            )}
          </TouchableOpacity>

          <View style={styles.instructions}>
            <Text style={styles.instructionText}>
              {getInstructionText()}
            </Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: 'white',
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  locationName: {
    fontSize: 16,
    color: '#666',
    marginBottom: 2,
  },
  locationAddress: {
    fontSize: 14,
    color: '#888',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  recordingsButton: {
    backgroundColor: '#34C759',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  recordingsButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  logoutButton: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  logoutButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  playButton: {
    backgroundColor: '#FF9500',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  playButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  recordingArea: {
    alignItems: 'center',
    width: '100%',
  },
  recordingIndicator: {
    alignItems: 'center',
    marginBottom: 40,
    padding: 20,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 200,
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'white',
    marginBottom: 8,
  },
  recordingText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  recordingTime: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  recordingStarted: {
    color: 'white',
    fontSize: 12,
    opacity: 0.9,
  },
  uploadingIndicator: {
    alignItems: 'center',
    marginBottom: 40,
    padding: 20,
    backgroundColor: '#007AFF',
    borderRadius: 10,
    minWidth: 200,
  },
  uploadingText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 4,
  },
  uploadingSubtext: {
    color: 'white',
    fontSize: 12,
    opacity: 0.9,
  },
  contactButton: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  contactButtonRecording: {
    backgroundColor: '#FF3B30',
  },
  contactButtonLoading: {
    backgroundColor: '#999',
  },
  contactButtonText: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: 30,
  },
  instructions: {
    marginTop: 40,
    paddingHorizontal: 20,
  },
  instructionText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  logsButton: {
    backgroundColor: '#FF9500',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  logsButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
}); 