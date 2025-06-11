# 📱 21VEK Contact Recorder - Мобильное Приложение

React Native / Expo приложение для записи и загрузки аудио переговоров продавцов.

## 🎯 Версия 0.1 - Стабильная

### ✅ Рабочие функции:
- Запись и воспроизведение аудио
- Загрузка на сервер
- Система логирования
- Аутентификация (admin/admin123)

### 🔧 Исправленные проблемы:
- GraphQL multipart конфликт при загрузке
- Воспроизведение аудио через expo-av
- Права доступа для Android
- Обработка ошибок сети

## 🚀 Установка

```bash
npm install
npx expo start
```

## 📦 Сборка APK

```bash
npx eas build -p android --profile preview
```

## 🔗 Связанные репозитории
- Backend: [contact-recorder-backend](https://github.com/kikanbig/contact-recorder-backend)

## 📱 Готовый APK
Скачать последнюю версию: [Expo Build](https://expo.dev/accounts/kikanbig/projects/21vek-contact-recorder)

## 🔧 Техническое

- **Platform**: React Native + Expo
- **Audio**: expo-av
- **HTTP**: FileSystem.uploadAsync (решает GraphQL multipart проблему)
- **Auth**: JWT Bearer токены
- **Logging**: Собственная система логирования

---
**Версия**: 0.1  
**Дата**: Июнь 2025 