# 🎙️ 21VEK Contact Recorder - Полный Проект v0.1

Система записи и анализа переговоров продавцов с клиентами.

## 📱 Архитектура Проекта

```
📱 Mobile App (React Native/Expo)
    ↓ HTTP API
🌐 Backend API (Node.js + PostgreSQL)
    ↓ Admin Panel  
💻 Web Interface (HTML/JS)
```

## 🔗 Репозитории

### 📱 Мобильное Приложение
- **GitHub**: https://github.com/kikanbig/21vek-contact-recorder-app
- **Тег**: v0.1
- **APK**: [Expo Builds](https://expo.dev/accounts/kikanbig/projects/21vek-contact-recorder)

### 🌐 Backend API
- **GitHub**: https://github.com/kikanbig/contact-recorder-backend  
- **Тег**: v0.1
- **Production**: https://contact-recorder-backend-production.up.railway.app
- **Admin Panel**: https://contact-recorder-backend-production.up.railway.app/admin/

## 🎯 Функциональность v0.1

### ✅ Готово
- [x] Запись аудио в мобильном приложении
- [x] Воспроизведение записей
- [x] Загрузка на сервер (решена GraphQL multipart проблема)
- [x] Веб админ панель
- [x] Браузерная транскрипция (бесплатная)
- [x] OpenAI Whisper транскрипция (платная, fallback)
- [x] JWT аутентификация
- [x] PostgreSQL база данных
- [x] Система логирования

### 📋 Учетные данные
- **Логин**: admin
- **Пароль**: admin123

## 🛠️ Ключевые Технические Решения

### 🔴 Проблема: GraphQL Multipart
**Симптом**: `"Misordered multipart fields; files should follow 'map'"`  
**Решение**: Использование `FileSystem.uploadAsync()` вместо `fetch() + FormData`

### 🔴 Проблема: OpenAI Квота  
**Симптом**: `"429 You exceeded your current quota"`  
**Решение**: Браузерная транскрипция через Web Speech Recognition API

### 🔴 Проблема: Аутентификация
**Симптом**: 401 с `продавец1/123456`  
**Решение**: Использование `admin/admin123` на production

## 📚 Документация

### 📖 Файлы документации:
- `README.md` - Описание проекта и установка
- `TROUBLESHOOTING.md` - Детальные проблемы и решения
- `PROJECT_SUMMARY.md` - Этот файл (обзор проекта)

### 🔧 API Документация:
- Swagger: `/api-docs` (если настроено)
- Postman коллекция: в репозитории backend

## 🚀 Деплой и Сборка

### 📱 Мобильное приложение:
```bash
# Разработка
npx expo start

# Сборка APK
npx eas build -p android --profile preview
```

### 🌐 Backend:
```bash
# Локально
npm run dev

# Production (Railway автоматически)
git push origin main
```

## 📊 Статистика Разработки

### 🔢 Метрики:
- **Время разработки**: ~2 недели
- **APK сборок**: 8+
- **Основных проблем решено**: 6
- **Строк кода**: ~3000 (Mobile + Backend)

### 🏆 Главные Достижения:
1. **Решена GraphQL multipart проблема** - критический блокер
2. **Создана бесплатная альтернатива OpenAI** - экономия средств
3. **Полный цикл CI/CD** - автоматический деплой
4. **Comprehensive logging** - упрощение отладки

## 🔄 Откат к Стабильной Версии

```bash
# Backend
cd ContactRecorderBackend
git checkout v0.1

# Mobile
cd ContactRecorderApp  
git checkout v0.1

# Деплой стабильной версии
git push origin main
```

## 🎯 Roadmap (Будущие Версии)

### v0.2 - Планируется:
- [ ] Управление пользователями в админке
- [ ] Фильтрация записей по дате
- [ ] Экспорт записей и транскрипций
- [ ] Push уведомления

### v0.3 - Планируется:
- [ ] Автоматическая синхронизация
- [ ] Офлайн режим
- [ ] Анализ тональности разговоров
- [ ] Интеграция с CRM

## 🔗 Полезные Ссылки

### 📚 Техническая документация:
- [GraphQL Multipart Request Spec](https://github.com/jaydenseric/graphql-multipart-request-spec)
- [Expo FileSystem](https://docs.expo.dev/versions/latest/sdk/filesystem/)
- [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)

### 🌐 Сервисы:
- [Railway](https://railway.app/) - Хостинг backend
- [Expo](https://expo.dev/) - Мобильная разработка и сборка APK
- [OpenAI](https://openai.com/) - Whisper API для транскрипции

---

**📅 Версия**: 0.1  
**🗓️ Дата релиза**: Июнь 2025  
**👨‍💻 Разработчик**: kikanbig  
**📈 Статус**: Стабильная рабочая версия ✅ 