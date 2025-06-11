# 🛠️ Трудности и Решения - Мобильное Приложение

Документация всех проблем, с которыми мы столкнулись при разработке, и их решений.

## 🎯 Основная Проблема: GraphQL Multipart Request Spec

### ❌ Проблема
При загрузке аудио файлов через `fetch()` + `FormData` получали ошибку:
```
"Misordered multipart fields; files should follow 'map' (https://github.com/jaydenseric/graphql-multipart-request-spec)"
```

### 🔍 Причина
React Native/Expo автоматически определяет multipart запросы и применяет GraphQL multipart спецификацию, которая требует:
1. Поле `operations` (JSON с операцией)
2. Поле `map` (мапинг файлов)
3. Затем файлы в определенном порядке

### ✅ Решение
Заменили `fetch()` на `FileSystem.uploadAsync()`:

```typescript
// ❌ НЕ РАБОТАЕТ
const formData = new FormData();
formData.append('audio', audioBlob);
fetch(url, { method: 'POST', body: formData });

// ✅ РАБОТАЕТ
FileSystem.uploadAsync(url, audioUri, {
  uploadType: FileSystem.FileSystemUploadType.MULTIPART,
  fieldName: 'audio',
  httpMethod: 'POST'
});
```

**Почему работает:** `FileSystem.uploadAsync()` использует нативные Android/iOS API, минуя JavaScript слой где происходит GraphQL интерпретация.

---

## 🎵 Проблема: Воспроизведение Аудио

### ❌ Проблема
Записанные аудио файлы не воспроизводились. AudioService возвращал мок-данные.

### 🔍 Причина
В `AudioService.ts` были только заглушки:
```typescript
async playRecording(uri: string): Promise<void> {
  // TODO: Implement audio playback
  console.log('Playing recording:', uri);
}
```

### ✅ Решение
Реализовали через `expo-av`:

```typescript
import { Audio } from 'expo-av';

async playRecording(uri: string): Promise<void> {
  try {
    const { sound } = await Audio.Sound.createAsync({ uri });
    await sound.playAsync();
    
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        sound.unloadAsync();
      }
    });
  } catch (error) {
    console.error('Ошибка воспроизведения:', error);
    throw error;
  }
}
```

---

## 🔐 Проблема: Аутентификация

### ❌ Проблема
Изначально пытались войти с `продавец1/123456`, но сервер возвращал 401.

### 🔍 Причина
На production сервере такого пользователя не существовало.

### ✅ Решение
Нашли рабочие учетные данные через curl тестирование:
- **Логин:** admin
- **Пароль:** admin123

```bash
# Тест аутентификации
curl -X POST https://contact-recorder-backend-production.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

---

## 📱 Проблема: Разрешения Android

### ❌ Проблема
Приложение не могло записывать аудио на Android.

### ✅ Решение
Добавили все необходимые разрешения в `app.json`:

```json
{
  "expo": {
    "plugins": [
      [
        "expo-av",
        {
          "microphonePermission": "Приложению нужен доступ к микрофону для записи аудио"
        }
      ]
    ],
    "android": {
      "permissions": [
        "android.permission.RECORD_AUDIO",
        "android.permission.INTERNET",
        "android.permission.ACCESS_NETWORK_STATE",
        "android.permission.WRITE_EXTERNAL_STORAGE",
        "android.permission.READ_EXTERNAL_STORAGE"
      ]
    }
  }
}
```

---

## 🐛 Проблема: Отладка

### ❌ Проблема
Сложно было понять что происходит на production устройстве.

### ✅ Решение
Создали систему логирования:

1. **Logger.ts** - централизованное логирование
2. **LogsScreen.tsx** - просмотр логов в приложении
3. **Кнопка "Логи"** - быстрый доступ к отладочной информации

```typescript
import { logger } from '../utils/Logger';

// Использование
logger.info('Upload started', { fileSize, filename });
logger.error('Upload failed', error);
logger.warn('Network slow', { duration });
```

---

## 🔄 Проблема: Кэширование

### ❌ Проблема
Пользователь подозревал проблемы с кэшем после неудачных загрузок.

### ✅ Решение
Создали процедуру полной очистки кэша:

```bash
# Очистка всех кэшей
npx expo start --clear
rm -rf node_modules
npm cache clean --force
rm -rf .expo
npm install
```

**Результат:** Проблема оказалась не в кэше, а в GraphQL multipart конфликте, но процедура очистки полезна для отладки.

---

## 📦 Проблема: Сборка APK

### ❌ Проблема
Множественные пересборки APK из-за изменений в коде.

### ✅ Решение
Использовали Expo Build Service:
- **Profile:** preview (быстрая сборка)
- **Platform:** android
- **Автоматизация:** `npx eas build -p android --profile preview --non-interactive`

**Итого создано:** 8+ APK файлов в процессе отладки.

---

## 🎛️ Настройки Audio Recording

### ✅ Оптимальная конфигурация

```typescript
await Audio.Recording.createAsync({
  isMeteringEnabled: true,
  android: {
    extension: '.m4a',
    outputFormat: Audio.RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_MPEG_4,
    audioEncoder: Audio.RECORDING_OPTION_ANDROID_AUDIO_ENCODER_AAC,
    sampleRate: 44100,
    numberOfChannels: 2,
    bitRate: 128000,
  },
  ios: {
    extension: '.m4a',
    outputFormat: Audio.RECORDING_OPTION_IOS_OUTPUT_FORMAT_MPEG4AAC,
    audioQuality: Audio.RECORDING_OPTION_IOS_AUDIO_QUALITY_HIGH,
    sampleRate: 44100,
    numberOfChannels: 2,
    bitRate: 128000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: 'audio/webm;codecs=opus',
    bitsPerSecond: 128000,
  },
});
```

---

## 💡 Ключевые Уроки

1. **GraphQL multipart** - React Native может интерпретировать обычные multipart запросы как GraphQL
2. **Native APIs** - Используйте нативные API (`FileSystem.uploadAsync`) вместо JavaScript (`fetch`) для файловых операций
3. **Логирование** - Создавайте систему логирования на ранней стадии разработки
4. **Тестирование** - Тестируйте API отдельно через curl перед интеграцией
5. **Разрешения** - Добавляйте все необходимые разрешения сразу в `app.json`

---

## 🔗 Полезные Ссылки

- [GraphQL Multipart Request Spec](https://github.com/jaydenseric/graphql-multipart-request-spec)
- [Expo FileSystem](https://docs.expo.dev/versions/latest/sdk/filesystem/)
- [Expo AV Documentation](https://docs.expo.dev/versions/latest/sdk/av/)
- [Android Permissions](https://docs.expo.dev/versions/latest/config/app/#permissions) 