import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Share
} from 'react-native';
import { logger } from '../utils/Logger';

interface LogsScreenProps {
  onClose: () => void;
}

export default function LogsScreen({ onClose }: LogsScreenProps) {
  const [logs, setLogs] = useState(logger.getLogs());
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      setLogs(logger.getLogs());
    }, 1000);

    return () => clearInterval(interval);
  }, [autoRefresh]);

  const handleClearLogs = () => {
    Alert.alert(
      'Очистить логи',
      'Вы уверены, что хотите очистить все логи?',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Очистить',
          style: 'destructive',
          onPress: () => {
            logger.clearLogs();
            setLogs([]);
          }
        }
      ]
    );
  };

  const handleShareLogs = async () => {
    try {
      const logsText = logger.getLogsAsText();
      await Share.share({
        message: `Логи приложения Contact Recorder:\n\n${logsText}`,
        title: 'Логи приложения'
      });
    } catch (error) {
      Alert.alert('Ошибка', 'Не удалось поделиться логами');
    }
  };

  const getLogColor = (level: string) => {
    switch (level) {
      case 'ERROR': return '#ff4444';
      case 'WARN': return '#ffaa00';
      default: return '#666';
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Логи отладки ({logs.length})</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity 
            style={[styles.button, styles.refreshButton]} 
            onPress={() => setAutoRefresh(!autoRefresh)}
          >
            <Text style={styles.buttonText}>
              {autoRefresh ? '⏸️ Стоп' : '▶️ Авто'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.button, styles.shareButton]} onPress={handleShareLogs}>
            <Text style={styles.buttonText}>📤 Отправить</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.button, styles.clearButton]} onPress={handleClearLogs}>
            <Text style={styles.buttonText}>🗑️ Очистить</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.button, styles.closeButton]} onPress={onClose}>
            <Text style={styles.buttonText}>❌ Закрыть</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        style={styles.logsContainer}
        ref={ref => ref?.scrollToEnd({ animated: true })}
      >
        {logs.length === 0 ? (
          <Text style={styles.noLogs}>Нет логов</Text>
        ) : (
          logs.map((log, index) => (
            <View key={index} style={styles.logEntry}>
              <View style={styles.logHeader}>
                <Text style={[styles.logLevel, { color: getLogColor(log.level) }]}>
                  {log.level}
                </Text>
                <Text style={styles.logTime}>
                  {new Date(log.timestamp).toLocaleTimeString('ru-RU')}
                </Text>
              </View>
              <Text style={styles.logMessage}>{log.message}</Text>
              {log.data && (
                <Text style={styles.logData}>{log.data}</Text>
              )}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    backgroundColor: '#333',
    padding: 15,
    paddingTop: 50,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  headerButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  button: {
    backgroundColor: '#555',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  refreshButton: {
    backgroundColor: '#007AFF',
  },
  shareButton: {
    backgroundColor: '#34C759',
  },
  clearButton: {
    backgroundColor: '#FF3B30',
  },
  closeButton: {
    backgroundColor: '#666',
  },
  buttonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  logsContainer: {
    flex: 1,
    padding: 10,
  },
  noLogs: {
    color: '#888',
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
  },
  logEntry: {
    backgroundColor: '#111',
    marginBottom: 8,
    padding: 10,
    borderRadius: 4,
    borderLeftWidth: 3,
    borderLeftColor: '#333',
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  logLevel: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  logTime: {
    color: '#888',
    fontSize: 11,
  },
  logMessage: {
    color: '#fff',
    fontSize: 13,
    lineHeight: 18,
  },
  logData: {
    color: '#aaa',
    fontSize: 11,
    marginTop: 5,
    fontFamily: 'monospace',
  },
}); 