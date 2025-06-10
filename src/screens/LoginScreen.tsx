import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { User, Location, SAMPLE_LOCATIONS } from '../types';
import { StorageService } from '../services/StorageService';
import { apiService, Location as ApiLocation } from '../../services/ApiService';

interface LoginScreenProps {
  onLogin: (user: User, location: Location) => void;
}

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [apiLocations, setApiLocations] = useState<ApiLocation[]>([]);

  // Простая проверка пользователей (в будущем заменить на API)
  const DEMO_USERS = [
    { username: 'продавец1', password: '123456' },
    { username: 'продавец2', password: '123456' },
    { username: 'администратор', password: 'admin123' },
  ];

  useEffect(() => {
    // Проверяем, есть ли сохраненная локация
    loadSavedLocation();
    // Загружаем локации с API
    loadApiLocations();
  }, []);

  const loadSavedLocation = async () => {
    const savedLocation = await StorageService.getSelectedLocation();
    if (savedLocation) {
      setSelectedLocationId(savedLocation.id);
    } else if (SAMPLE_LOCATIONS.length > 0) {
      setSelectedLocationId(SAMPLE_LOCATIONS[0].id);
    }
  };

  const loadApiLocations = async () => {
    try {
      // Пытаемся загрузить локации с API
      const testAuth = await apiService.login('продавец1', '123456');
      if (testAuth.success) {
        const locationsResponse = await apiService.getLocations();
        if (locationsResponse.success) {
          setApiLocations(locationsResponse.locations);
        }
        apiService.clearToken();
      }
    } catch (error) {
      console.log('Не удалось загрузить локации с API, используем локальные');
    }
  };

  const handleLogin = async () => {
    if (!username.trim()) {
      Alert.alert('Ошибка', 'Введите имя пользователя');
      return;
    }

    if (!password.trim()) {
      Alert.alert('Ошибка', 'Введите пароль');
      return;
    }

    if (!selectedLocationId) {
      Alert.alert('Ошибка', 'Выберите локацию');
      return;
    }

    setIsLoading(true);

    try {
      // Пытаемся авторизоваться через API
      const response = await apiService.login(username, password);
      
      if (response.success) {
        // Находим выбранную локацию
        let selectedLocation: Location | undefined;
        
        if (apiLocations.length > 0) {
          const apiLocation = apiLocations.find(loc => loc.id.toString() === selectedLocationId);
          if (apiLocation) {
            selectedLocation = {
              id: apiLocation.id.toString(),
              name: apiLocation.name,
              address: apiLocation.address,
            };
          }
        } else {
          selectedLocation = SAMPLE_LOCATIONS.find(loc => loc.id === selectedLocationId);
        }
        
        if (!selectedLocation) {
          Alert.alert('Ошибка', 'Выбранная локация не найдена');
          return;
        }

        const user: User = {
          id: response.user.id.toString(),
          username: response.user.username,
          password,
          isLoggedIn: true,
        };

        // Сохраняем данные
        await StorageService.saveUser(user);
        await StorageService.saveSelectedLocation(selectedLocation);

        onLogin(user, selectedLocation);
      } else {
        Alert.alert('Ошибка', response.message || 'Неверное имя пользователя или пароль');
      }
    } catch (error) {
      // Fallback к локальной авторизации
      const isValidUser = DEMO_USERS.some(
        user => user.username === username && user.password === password
      );

      if (!isValidUser) {
        Alert.alert('Ошибка', 'Неверное имя пользователя или пароль');
        return;
      }

      const selectedLocation = SAMPLE_LOCATIONS.find(loc => loc.id === selectedLocationId);
      if (!selectedLocation) {
        Alert.alert('Ошибка', 'Выбранная локация не найдена');
        return;
      }

      const user: User = {
        id: Date.now().toString(),
        username,
        password,
        isLoggedIn: true,
      };

      await StorageService.saveUser(user);
      await StorageService.saveSelectedLocation(selectedLocation);

      onLogin(user, selectedLocation);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.form}>
          <Text style={styles.title}>Авторизация продавца</Text>
          
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Имя пользователя:</Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="Введите логин"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Пароль:</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Введите пароль"
              secureTextEntry
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Выберите локацию:</Text>
            <View style={styles.pickerContainer}>
              <Picker
                selectedValue={selectedLocationId}
                onValueChange={setSelectedLocationId}
                style={styles.picker}
              >
                <Picker.Item label="Выберите магазин..." value="" />
                {SAMPLE_LOCATIONS.map((location) => (
                  <Picker.Item
                    key={location.id}
                    label={`${location.name} (${location.address})`}
                    value={location.id}
                  />
                ))}
              </Picker>
            </View>
          </View>

          <TouchableOpacity 
            style={[styles.loginButton, isLoading && styles.loginButtonDisabled]} 
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <Text style={styles.loginButtonText}>Вход...</Text>
            ) : (
              <Text style={styles.loginButtonText}>Войти</Text>
            )}
          </TouchableOpacity>

          <View style={styles.demoInfo}>
            <Text style={styles.demoText}>Демо-пользователи:</Text>
            <Text style={styles.demoText}>• продавец1 / 123456</Text>
            <Text style={styles.demoText}>• продавец2 / 123456</Text>
            <Text style={styles.demoText}>• администратор / admin123</Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  form: {
    backgroundColor: 'white',
    padding: 30,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 30,
    color: '#333',
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    color: '#333',
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: '#fff',
  },
  picker: {
    height: 50,
  },
  loginButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 15,
    borderRadius: 8,
    marginTop: 20,
  },
  loginButtonDisabled: {
    backgroundColor: '#ccc',
  },
  loginButtonText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 18,
    fontWeight: 'bold',
  },
  demoInfo: {
    marginTop: 30,
    padding: 15,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
  },
  demoText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginBottom: 2,
  },
}); 