import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  Modal,
  ScrollView,
} from 'react-native';
import { useAudioPlayer } from 'expo-audio';
import { Recording, SAMPLE_LOCATIONS, User } from '../types';
import { StorageService } from '../services/StorageService';
import { apiService } from '../../services/ApiService';

interface RecordingsListScreenProps {
  user: User;
  onBack: () => void;
}

interface RecordingWithTranscription extends Recording {
  transcription?: string;
  transcribedAt?: string;
  isTranscribing?: boolean;
}

export default function RecordingsListScreen({ user, onBack }: RecordingsListScreenProps) {
  const [recordings, setRecordings] = useState<RecordingWithTranscription[]>([]);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [serverRecordings, setServerRecordings] = useState<any[]>([]);
  const [selectedTranscription, setSelectedTranscription] = useState<{
    transcription: string;
    fileName: string;
    transcribedAt: string;
  } | null>(null);

  useEffect(() => {
    loadRecordings();
    loadServerRecordings();
  }, []);

  const loadRecordings = async () => {
    try {
      const localRecordings = await StorageService.getRecordings();
      setRecordings(localRecordings.map(r => ({ ...r, isTranscribing: false })));
    } catch (error) {
      console.error('Ошибка загрузки записей:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadServerRecordings = async () => {
    try {
      const response = await apiService.getRecordings();
      if (response.success) {
        setServerRecordings(response.recordings);
      }
    } catch (error) {
      console.log('Не удалось загрузить записи с сервера:', error);
    }
  };

  const playRecording = async (recording: RecordingWithTranscription) => {
    try {
      // Если нажали на ту же запись, просто останавливаем
      if (playingId === recording.id) {
        setPlayingId(null);
        return;
      }

      // Устанавливаем ID воспроизводимой записи
      setPlayingId(recording.id);

      // Симуляция воспроизведения (expo-audio требует компонента)
      setTimeout(() => {
        setPlayingId(null);
      }, 3000); // Останавливаем через 3 секунды

    } catch (error) {
      console.error('Ошибка при воспроизведении:', error);
      Alert.alert('Ошибка', 'Не удалось воспроизвести запись');
    }
  };

  const handleTranscribe = async (recording: RecordingWithTranscription) => {
    // Ищем соответствующую запись на сервере
    const serverRecording = serverRecordings.find(sr => 
      sr.fileName === `recording_${user.username}_${recording.startTime.toISOString().replace(/[:.]/g, '-')}.m4a`
    );

    if (!serverRecording) {
      Alert.alert(
        'Ошибка',
        'Запись не найдена на сервере. Убедитесь, что запись была синхронизирована.'
      );
      return;
    }

    // Проверяем, есть ли уже транскрипция
    try {
      const existingTranscription = await apiService.getTranscription(serverRecording.id);
      if (existingTranscription.success && existingTranscription.transcription) {
        setSelectedTranscription({
          transcription: existingTranscription.transcription,
          fileName: serverRecording.fileName,
          transcribedAt: existingTranscription.transcribedAt || 'Неизвестно'
        });
        return;
      }
    } catch (error) {
      // Транскрипции нет, продолжаем создание
    }

    // Обновляем состояние - показываем индикатор загрузки
    setRecordings(prev => prev.map(r => 
      r.id === recording.id ? { ...r, isTranscribing: true } : r
    ));

    try {
      // Имитируем аудио данные (в реальном проекте здесь будет чтение файла)
      const mockAudioData = "mock_base64_audio_data";
      
      const result = await apiService.transcribeRecording(serverRecording.id, mockAudioData);
      
      if (result.success && result.transcription) {
        // Обновляем локальную запись
        setRecordings(prev => prev.map(r => 
          r.id === recording.id 
            ? { ...r, transcription: result.transcription, transcribedAt: result.transcribedAt, isTranscribing: false }
            : r
        ));

        // Показываем транскрипцию
        setSelectedTranscription({
          transcription: result.transcription,
          fileName: serverRecording.fileName,
          transcribedAt: result.transcribedAt || 'Только что'
        });

        Alert.alert('Успех', 'Транскрипция завершена!');
      } else {
        throw new Error(result.message || 'Ошибка транскрипции');
      }
    } catch (error) {
      console.error('Ошибка транскрипции:', error);
      Alert.alert('Ошибка', 'Не удалось выполнить транскрипцию');
    } finally {
      setRecordings(prev => prev.map(r => 
        r.id === recording.id ? { ...r, isTranscribing: false } : r
      ));
    }
  };

  const handleDeleteRecording = (recording: Recording) => {
    Alert.alert(
      'Удаление записи',
      'Вы уверены, что хотите удалить эту запись?',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: async () => {
            try {
              await StorageService.removeRecording(recording.id);
              setRecordings(prev => prev.filter(r => r.id !== recording.id));
            } catch (error) {
              Alert.alert('Ошибка', 'Не удалось удалить запись');
            }
          },
        },
      ]
    );
  };

  const formatDate = (date: Date) => {
    const recordingDate = new Date(date);
    return recordingDate.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (durationMs: number) => {
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getLocationName = (locationId: string) => {
    const location = SAMPLE_LOCATIONS.find(loc => loc.id === locationId);
    return location ? location.name : 'Неизвестная локация';
  };

  const renderRecordingItem = ({ item }: { item: RecordingWithTranscription }) => (
    <View style={styles.recordingItem}>
      <View style={styles.recordingHeader}>
        <Text style={styles.recordingTitle}>
          Запись {formatDate(item.startTime)}
        </Text>
        <Text style={styles.recordingDuration}>
          {formatDuration(item.duration)}
        </Text>
      </View>
      
      <Text style={styles.recordingLocation}>{getLocationName(item.locationId)}</Text>
      
      <View style={styles.recordingActions}>
        <TouchableOpacity
          style={[
            styles.playButton,
            playingId === item.id && styles.playButtonActive
          ]}
          onPress={() => playRecording(item)}
        >
          <Text style={styles.playButtonText}>
            {playingId === item.id ? 'Стоп' : 'Играть'}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.actionButton, styles.transcribeButton]}
          onPress={() => handleTranscribe(item)}
          disabled={item.isTranscribing}
        >
          {item.isTranscribing ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text style={styles.actionButtonText}>
              {item.transcription ? 'Показать текст' : 'Транскрипция'}
            </Text>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={() => handleDeleteRecording(item)}
        >
          <Text style={styles.actionButtonText}>Удалить</Text>
        </TouchableOpacity>
      </View>
      
      <Text style={styles.recordingPath}>
        Файл: {item.audioFilePath.split('/').pop()}
      </Text>
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Загрузка записей...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>← Назад</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Записи ({recordings.length})</Text>
      </View>

      <View style={styles.statsContainer}>
        <Text style={styles.statsText}>
          Всего записей: {recordings.length}
        </Text>
        <Text style={styles.statsText}>
          На сервере: {serverRecordings.length}
        </Text>
      </View>

      {recordings.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Записей пока нет</Text>
          <Text style={styles.emptySubtext}>
            Нажмите кнопку "КОНТАКТ" на главном экране для создания записи
          </Text>
        </View>
      ) : (
        <FlatList
          data={recordings}
          keyExtractor={(item) => item.id}
          renderItem={renderRecordingItem}
          style={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Модальное окно для показа транскрипции */}
      <Modal
        visible={selectedTranscription !== null}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setSelectedTranscription(null)}
            >
              <Text style={styles.modalCloseText}>Закрыть</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Транскрипция</Text>
            <View style={styles.placeholder} />
          </View>
          
          {selectedTranscription && (
            <ScrollView style={styles.modalContent}>
              <View style={styles.transcriptionHeader}>
                <Text style={styles.transcriptionFileName}>
                  {selectedTranscription.fileName}
                </Text>
                <Text style={styles.transcriptionDate}>
                  Транскрибирована: {new Date(selectedTranscription.transcribedAt).toLocaleString('ru-RU')}
                </Text>
              </View>
              
              <View style={styles.transcriptionTextContainer}>
                <Text style={styles.transcriptionText}>
                  {selectedTranscription.transcription}
                </Text>
              </View>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
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
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  backButton: {
    paddingVertical: 8,
    paddingRight: 16,
  },
  backButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  list: {
    flex: 1,
    padding: 16,
  },
  recordingItem: {
    backgroundColor: 'white',
    padding: 16,
    marginBottom: 12,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 1.41,
    elevation: 2,
  },
  recordingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  recordingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  recordingDuration: {
    fontSize: 14,
    color: '#666',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  recordingLocation: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  recordingActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  playButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    flex: 1,
  },
  playButtonActive: {
    backgroundColor: '#FF3B30',
  },
  playButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  transcribeButton: {
    backgroundColor: '#34C759',
  },
  deleteButton: {
    backgroundColor: '#FF3B30',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  recordingPath: {
    fontSize: 10,
    color: '#999',
    fontFamily: 'monospace',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
  },
  statsContainer: {
    backgroundColor: 'white',
    padding: 16,
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statsText: {
    fontSize: 14,
    color: '#666',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  modalHeader: {
    backgroundColor: 'white',
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalCloseButton: {
    padding: 8,
  },
  modalCloseText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  transcriptionHeader: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  transcriptionFileName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  transcriptionDate: {
    fontSize: 14,
    color: '#666',
  },
  transcriptionTextContainer: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    minHeight: 200,
  },
  transcriptionText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#333',
  },
  placeholder: {
    width: 60,
  },
}); 